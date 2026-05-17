import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';
import { inngest } from '@/lib/inngest';
import { checkScanLimit } from '@/lib/ratelimit';
import { checkScanLimitRedis } from '@/lib/redis';
import { runScan } from '@/lib/scan-runner';

export const runtime = 'nodejs';
export const maxDuration = 300;

const Body = z.object({ contractId: z.string().uuid() });

export async function POST(req: Request) {
  const user = await requireUser();
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: 'contractId required' }, { status: 400 });

  const [contract] = await db
    .select()
    .from(schema.contracts)
    .where(and(eq(schema.contracts.id, parsed.data.contractId), eq(schema.contracts.userId, user.id)));
  if (!contract) return Response.json({ error: 'contract not found' }, { status: 404 });

  const [userRow] = await db.select({ plan: schema.users.plan }).from(schema.users).where(eq(schema.users.id, user.id));
  const plan = userRow?.plan ?? 'free';
  const limit = process.env.UPSTASH_REDIS_REST_URL
    ? await checkScanLimitRedis(user.id, plan)
    : await checkScanLimit(user.id, plan);
  if (!limit.allowed) {
    return Response.json({ error: 'limit-reached', ...limit }, { status: 429 });
  }

  const [scan] = await db
    .insert(schema.scans)
    .values({ contractId: contract.id, status: 'queued' })
    .returning({ id: schema.scans.id });

  if (process.env.INNGEST_EVENT_KEY) {
    await inngest.send({ name: 'scan/run', data: { scanId: scan.id } });
  } else {
    // Fallback: fire-and-forget inline (Day-1).
    runScan(scan.id).catch((err) => console.error('scan failed', scan.id, err));
  }

  return Response.json({ scanId: scan.id, streamUrl: `/api/scans/${scan.id}/stream` }, { status: 202 });
}

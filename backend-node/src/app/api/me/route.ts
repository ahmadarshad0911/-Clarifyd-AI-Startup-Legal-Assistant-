import { and, count, eq, gte } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

const PLAN_LIMITS: Record<string, number> = {
  free: Number(process.env.FREE_TIER_SCAN_LIMIT ?? 3),
  starter: 15,
  pro: 50,
  business: 200,
  admin: 9999,
};

export async function GET() {
  const user = await requireUser();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  const since = new Date(Date.now() - 30 * 86400_000);

  const [scanCount] = await db
    .select({ value: count() })
    .from(schema.scans)
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(and(eq(schema.contracts.userId, user.id), gte(schema.scans.startedAt, since)));

  const [ctx] = await db
    .select()
    .from(schema.userContext)
    .where(eq(schema.userContext.userId, user.id));

  const limit = PLAN_LIMITS[u?.plan ?? 'free'] ?? PLAN_LIMITS.free;
  return Response.json({
    id: u?.id,
    email: u?.email,
    name: u?.name,
    plan: u?.plan ?? 'free',
    createdAt: u?.createdAt,
    usage: { scansThisMonth: scanCount?.value ?? 0, limit, remaining: Math.max(0, limit - (scanCount?.value ?? 0)) },
    context: ctx ?? { jurisdiction: 'US', stage: 'seed', role: 'founder' },
  });
}

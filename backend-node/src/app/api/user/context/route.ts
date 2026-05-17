import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

const Ctx = z.object({
  jurisdiction: z.enum(['US', 'UK', 'EU', 'IN', 'SG']),
  stage: z.enum(['pre-seed', 'seed', 'series-a', 'series-b']),
  role: z.enum(['founder', 'gc', 'investor', 'vendor']),
});

export async function GET() {
  const user = await requireUser();
  const [row] = await db.select().from(schema.userContext).where(eq(schema.userContext.userId, user.id));
  return Response.json(row ?? { jurisdiction: 'US', stage: 'seed', role: 'founder' });
}

export async function PUT(req: Request) {
  const user = await requireUser();
  const parsed = Ctx.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'invalid context' }, { status: 400 });
  await db
    .insert(schema.userContext)
    .values({ userId: user.id, ...parsed.data })
    .onConflictDoUpdate({ target: schema.userContext.userId, set: { ...parsed.data, updatedAt: new Date() } });
  return Response.json({ ok: true });
}

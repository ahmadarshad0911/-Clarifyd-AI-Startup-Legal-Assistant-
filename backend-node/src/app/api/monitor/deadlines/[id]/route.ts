import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  status: z.enum(['active', 'snoozed', 'dismissed']),
  snoozeUntil: z.string().datetime().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const res = await db
    .update(schema.deadlines)
    .set({
      status: parsed.data.status,
      snoozeUntil: parsed.data.snoozeUntil ? new Date(parsed.data.snoozeUntil) : null,
    })
    .where(and(eq(schema.deadlines.id, id), eq(schema.deadlines.userId, user.id)))
    .returning({ id: schema.deadlines.id });
  if (res.length === 0) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ ok: true });
}

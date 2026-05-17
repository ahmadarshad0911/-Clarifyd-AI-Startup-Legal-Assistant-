import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

const Patch = z.object({
  name: z.string().min(2).optional(),
  firm: z.string().optional(),
  email: z.string().email().optional(),
  jurisdictions: z.array(z.string()).min(1).optional(),
  flatFeeUsd: z.number().int().nonnegative().optional(),
  hourlyUsd: z.number().int().nonnegative().optional(),
  avatarUrl: z.string().url().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const res = await db
    .update(schema.lawyers)
    .set(parsed.data)
    .where(eq(schema.lawyers.id, id))
    .returning();
  if (res.length === 0) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json(res[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  await db.update(schema.lawyers).set({ active: false }).where(eq(schema.lawyers.id, id));
  return Response.json({ ok: true });
}

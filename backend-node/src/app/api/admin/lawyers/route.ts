import { z } from 'zod';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

const Body = z.object({
  name: z.string().min(2),
  firm: z.string().optional(),
  email: z.string().email().optional(),
  jurisdictions: z.array(z.string()).min(1),
  flatFeeUsd: z.number().int().nonnegative().optional(),
  hourlyUsd: z.number().int().nonnegative().optional(),
  avatarUrl: z.string().url().optional(),
});

export async function GET() {
  await requireAdmin();
  const rows = await db.select().from(schema.lawyers);
  return Response.json(rows);
}

export async function POST(req: Request) {
  await requireAdmin();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const [row] = await db.insert(schema.lawyers).values(parsed.data).returning();
  return Response.json(row, { status: 201 });
}

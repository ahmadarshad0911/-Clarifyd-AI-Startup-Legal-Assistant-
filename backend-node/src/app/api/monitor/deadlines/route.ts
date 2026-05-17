import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  contractId: z.string().uuid().optional(),
  kind: z.string(),
  label: z.string(),
  dueAt: z.string().datetime(),
});

export async function GET() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.deadlines)
    .where(
      and(
        eq(schema.deadlines.userId, user.id),
        or(eq(schema.deadlines.status, 'active'), isNull(schema.deadlines.status)),
      ),
    )
    .orderBy(asc(schema.deadlines.dueAt));
  return Response.json(rows);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const [row] = await db
    .insert(schema.deadlines)
    .values({
      userId: user.id,
      contractId: parsed.data.contractId ?? null,
      kind: parsed.data.kind,
      label: parsed.data.label,
      dueAt: new Date(parsed.data.dueAt),
    })
    .returning();
  return Response.json(row, { status: 201 });
}

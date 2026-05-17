import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { appendAudit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  decision: z.enum(['accepted', 'rejected', 'edited']),
  editText: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: 'decision required' }, { status: 400 });

  const [row] = await db
    .select({
      finding: schema.findings,
      ownerId: schema.contracts.userId,
      scanId: schema.findings.scanId,
    })
    .from(schema.findings)
    .innerJoin(schema.scans, eq(schema.findings.scanId, schema.scans.id))
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(eq(schema.findings.id, id));
  if (!row || row.ownerId !== user.id) return Response.json({ error: 'not found' }, { status: 404 });

  await db
    .update(schema.findings)
    .set({
      userDecision: parsed.data.decision,
      userEdit: parsed.data.editText,
      decidedAt: new Date(),
    })
    .where(eq(schema.findings.id, id));
  await appendAudit(row.scanId!, 'user_decision', {
    findingId: id,
    decision: parsed.data.decision,
    edited: Boolean(parsed.data.editText),
  });

  // User-corpus auto-builder: every accepted clause feeds back into
  // `user:{userId}` playbook so future PlaybookCompare can use your history.
  if (parsed.data.decision === 'accepted') {
    const finalText = parsed.data.editText ?? row.finding.rewriteText ?? row.finding.originalText;
    const [scanContract] = await db
      .select({ docType: schema.contracts.docType })
      .from(schema.scans)
      .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
      .where(eq(schema.scans.id, row.scanId!));
    await db
      .insert(schema.playbookClauses)
      .values({
        corpus: `user:${user.id}`,
        docType: scanContract?.docType ?? 'SAFE',
        clauseId: row.finding.clauseId,
        text: finalText,
        sampleSize: 1,
      })
      .onConflictDoNothing();
  }

  return Response.json({ ok: true });
}

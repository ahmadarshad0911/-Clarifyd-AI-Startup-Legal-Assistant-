import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [scan] = await db
    .select({ scan: schema.scans })
    .from(schema.scans)
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(and(eq(schema.scans.id, id), eq(schema.contracts.userId, user.id)));
  if (!scan) return Response.json({ error: 'not found' }, { status: 404 });

  const rows = await db.select().from(schema.findings).where(eq(schema.findings.scanId, id));
  return Response.json({
    scan: scan.scan,
    findings: rows.map((r) => ({
      id: r.id,
      clauseId: r.clauseId,
      severity: r.severity,
      score: Number(r.score),
      confidence: Number(r.confidence),
      originalText: r.originalText,
      rewriteText: r.rewriteText,
      rationale: r.rationale,
      userDecision: r.userDecision,
    })),
  });
}

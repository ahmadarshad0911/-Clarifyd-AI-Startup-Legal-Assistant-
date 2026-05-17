import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const user = await requireUser();
  const { scanId } = await params;
  const url = new URL(req.url);
  const corpus = url.searchParams.get('corpus') ?? 'yc-w26';

  const [own] = await db
    .select({ ownerId: schema.contracts.userId, docType: schema.contracts.docType })
    .from(schema.scans)
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(eq(schema.scans.id, scanId));
  if (!own || own.ownerId !== user.id) return Response.json({ error: 'not found' }, { status: 404 });

  const yourFindings = await db.select().from(schema.findings).where(eq(schema.findings.scanId, scanId));
  const corpusClauses = await db
    .select()
    .from(schema.playbookClauses)
    .where(and(eq(schema.playbookClauses.corpus, corpus), eq(schema.playbookClauses.docType, own.docType ?? 'SAFE')));

  const byClause = new Map(corpusClauses.map((c) => [c.clauseId, c]));
  const out = yourFindings.map((f) => {
    const std = byClause.get(f.clauseId);
    return {
      clauseId: f.clauseId,
      yours: { text: f.originalText, severity: f.severity, score: Number(f.score) },
      corpus: std
        ? { text: std.text, median: std.medianValue, p25: std.p25Value, p75: std.p75Value, sampleSize: std.sampleSize }
        : null,
      delta: std ? 'differs' : 'no-baseline',
    };
  });
  return Response.json({ corpus, clauses: out });
}

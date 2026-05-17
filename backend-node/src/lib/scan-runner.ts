import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { appendAudit } from './audit';
import { tagClauses } from './clauses';
import { chunk, embed } from './embeddings';
import { analyzeClause } from './kimi';
import { extractText } from './pdf';
import { computeHealthScore } from './score';

// Runs synchronously (Day-1 MVP). Move to Inngest later.
export async function runScan(scanId: string): Promise<void> {
  const start = Date.now();
  await db
    .update(schema.scans)
    .set({
      status: 'running',
      startedAt: new Date(),
      model: process.env.NIM_MODEL_ID ?? 'meta/llama-3.3-70b-instruct',
    })
    .where(eq(schema.scans.id, scanId));
  await appendAudit(scanId, 'scan_start', { at: new Date().toISOString() });

  const [scan] = await db.select().from(schema.scans).where(eq(schema.scans.id, scanId));
  if (!scan?.contractId) throw new Error('scan missing contract');
  const [contract] = await db.select().from(schema.contracts).where(eq(schema.contracts.id, scan.contractId));
  if (!contract) throw new Error('contract not found');
  // Update last_accessed_at on every scan invocation.
  await db
    .update(schema.contracts)
    .set({ lastAccessedAt: new Date() })
    .where(eq(schema.contracts.id, contract.id));
  const ctx = (await db
    .select()
    .from(schema.userContext)
    .where(eq(schema.userContext.userId, contract.userId!))
    .limit(1))[0] ?? { jurisdiction: 'US', stage: 'seed', role: 'founder' };

  try {
    const buf = contract.fileBytes
      ? Buffer.from(contract.fileBytes as Buffer)
      : Buffer.from(await (await fetch(contract.blobUrl)).arrayBuffer());
    const { text, words } = await extractText(buf);
    await appendAudit(scanId, 'extract', { words });
    await db.update(schema.contracts).set({ wordCount: words }).where(eq(schema.contracts.id, contract.id));

    const raw = tagClauses(text);
    const counts = { critical: 0, high: 0, medium: 0, clean: 0 };

    for (const r of raw) {
      const a = await analyzeClause(r.clauseId, r.text, ctx);
      await db.insert(schema.findings).values({
        scanId,
        clauseId: r.clauseId,
        severity: a.severity,
        score: String(a.score),
        confidence: String(a.confidence),
        originalText: r.text,
        rewriteText: a.rewrite,
        rationale: a.rationale,
      });
      await appendAudit(scanId, 'finding_emit', {
        clauseId: r.clauseId,
        severity: a.severity,
        score: a.score,
        confidence: a.confidence,
      });
      if (a.severity === 'critical') counts.critical++;
      else if (a.severity === 'high') counts.high++;
      else if (a.severity === 'medium') counts.medium++;
      else counts.clean++;
    }

    // Index for cross-contract Q&A (W3 feature). Best-effort.
    try {
      for (const piece of chunk(text)) {
        const vec = await embed(piece);
        await db.insert(schema.scanEmbeddings).values({
          userId: contract.userId,
          scanId,
          chunk: piece,
          embedding: vec,
          metadata: { docType: contract.docType ?? null },
        });
      }
    } catch (err) {
      console.warn('embed failed (non-fatal)', String(err));
    }

    const healthScore = computeHealthScore(counts);
    const durationMs = Date.now() - start;
    await db
      .update(schema.scans)
      .set({
        status: 'done',
        healthScore,
        criticalN: counts.critical,
        highN: counts.high,
        mediumN: counts.medium,
        cleanN: counts.clean,
        durationMs,
        finishedAt: new Date(),
      })
      .where(eq(schema.scans.id, scanId));
    await appendAudit(scanId, 'scan_done', { healthScore, ...counts, durationMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    await db
      .update(schema.scans)
      .set({ status: 'error', errorMessage: message, finishedAt: new Date() })
      .where(eq(schema.scans.id, scanId));
    await appendAudit(scanId, 'scan_error', { message });
    throw err;
  }
}

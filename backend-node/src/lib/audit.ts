import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { canonicalJson, sha256 } from './hash';

const GENESIS = '0'.repeat(64);

export type AuditEventType =
  | 'scan_start'
  | 'classify'
  | 'extract'
  | 'finding_emit'
  | 'scan_done'
  | 'scan_error'
  | 'user_decision'
  | 'export'
  | 'consent';

export async function appendAudit(
  scanId: string,
  eventType: AuditEventType,
  payload: Record<string, unknown>,
): Promise<{ id: number; thisHash: string }> {
  const [last] = await db
    .select({ thisHash: schema.auditLog.thisHash })
    .from(schema.auditLog)
    .where(eq(schema.auditLog.scanId, scanId))
    .orderBy(desc(schema.auditLog.id))
    .limit(1);
  const prevHash = last?.thisHash ?? GENESIS;
  const thisHash = sha256(prevHash + canonicalJson({ eventType, payload }));
  const [row] = await db
    .insert(schema.auditLog)
    .values({ scanId, eventType, payload, prevHash, thisHash })
    .returning({ id: schema.auditLog.id, thisHash: schema.auditLog.thisHash });
  return row;
}

export async function verifyAuditChain(scanId: string): Promise<{ valid: boolean; brokenAt?: number }> {
  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.scanId, scanId))
    .orderBy(schema.auditLog.id);
  let prev = GENESIS;
  for (const r of rows) {
    const expected = sha256(prev + canonicalJson({ eventType: r.eventType, payload: r.payload }));
    if (expected !== r.thisHash || r.prevHash !== prev) return { valid: false, brokenAt: r.id };
    prev = r.thisHash;
  }
  return { valid: true };
}

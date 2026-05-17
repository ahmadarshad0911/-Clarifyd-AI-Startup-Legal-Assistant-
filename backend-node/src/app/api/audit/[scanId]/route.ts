import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { verifyAuditChain } from '@/lib/audit';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const user = await requireUser();
  const { scanId } = await params;

  const [own] = await db
    .select({ contractUserId: schema.contracts.userId })
    .from(schema.scans)
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(eq(schema.scans.id, scanId));
  if (!own || own.contractUserId !== user.id) return Response.json({ error: 'not found' }, { status: 404 });

  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.scanId, scanId))
    .orderBy(asc(schema.auditLog.id));
  const verify = await verifyAuditChain(scanId);

  return Response.json({
    valid: verify.valid,
    brokenAt: verify.brokenAt,
    events: rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      payload: r.payload,
      prevHash: r.prevHash,
      thisHash: r.thisHash,
      createdAt: r.createdAt,
    })),
  });
}

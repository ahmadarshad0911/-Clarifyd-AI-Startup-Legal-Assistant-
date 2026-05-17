import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const user = await requireUser();
  const { scanId } = await params;

  const [own] = await db
    .select({ ownerId: schema.contracts.userId })
    .from(schema.scans)
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(eq(schema.scans.id, scanId));
  if (!own || own.ownerId !== user.id) return Response.json({ error: 'not found' }, { status: 404 });

  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.scanId, scanId))
    .orderBy(asc(schema.auditLog.id));

  const json = JSON.stringify({ scanId, exportedAt: new Date().toISOString(), events: rows }, null, 2);
  return new Response(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="audit-${scanId}.json"`,
    },
  });
}

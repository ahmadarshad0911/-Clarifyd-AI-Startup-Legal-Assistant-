import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';
import { extractTokens } from '@/lib/pii';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [row] = await db
    .select({
      finding: schema.findings,
      contract: schema.contracts,
      ownerId: schema.contracts.userId,
    })
    .from(schema.findings)
    .innerJoin(schema.scans, eq(schema.findings.scanId, schema.scans.id))
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(eq(schema.findings.id, id));
  if (!row || row.ownerId !== user.id) return Response.json({ error: 'not found' }, { status: 404 });

  const tokens = extractTokens({
    userEmail: user.email,
    filename: row.contract.filename,
    docType: row.contract.docType,
  });

  const subject = `${row.contract.docType ?? 'Contract'} — proposed amendments`;
  const body = [
    `Hi ${tokens.vendor === 'Counterparty' ? 'team' : tokens.vendor + ' team'},`,
    ``,
    `Reviewing the ${row.contract.docType ?? 'document'} you sent (${row.contract.filename}), one clause needs adjustment before we can sign:`,
    ``,
    `Clause: ${row.finding.clauseId} (severity: ${row.finding.severity})`,
    `Current language: ${row.finding.originalText.slice(0, 400)}`,
    ``,
    `Proposed rewrite:`,
    row.finding.rewriteText ?? '(no rewrite available)',
    ``,
    `Rationale: ${row.finding.rationale ?? 'see attached scan'}`,
    ``,
    `Happy to jump on a 15-min call.`,
    ``,
    `— ${tokens.founder}`,
    tokens.company ? `${tokens.company}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return Response.json({
    to: tokens.vendorEmail,
    subject,
    body,
    tokens,
  });
}

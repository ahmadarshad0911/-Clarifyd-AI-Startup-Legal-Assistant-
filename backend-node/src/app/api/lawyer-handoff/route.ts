import { createHmac } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

const Body = z.object({ lawyerId: z.string().uuid(), scanId: z.string().uuid() });

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });

  const [scanOwn] = await db
    .select({ scan: schema.scans, contract: schema.contracts })
    .from(schema.scans)
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(and(eq(schema.scans.id, parsed.data.scanId), eq(schema.contracts.userId, user.id)));
  if (!scanOwn) return Response.json({ error: 'scan not found' }, { status: 404 });

  const [lawyer] = await db.select().from(schema.lawyers).where(eq(schema.lawyers.id, parsed.data.lawyerId));
  if (!lawyer) return Response.json({ error: 'lawyer not found' }, { status: 404 });

  const findings = await db.select().from(schema.findings).where(eq(schema.findings.scanId, parsed.data.scanId));
  const payload = {
    userEmail: user.email,
    scanId: scanOwn.scan.id,
    healthScore: scanOwn.scan.healthScore,
    blobUrl: scanOwn.contract.blobUrl,
    findings: findings.map((f) => ({
      clauseId: f.clauseId,
      severity: f.severity,
      original: f.originalText,
      rewrite: f.rewriteText,
    })),
  };
  const sig = createHmac('sha256', process.env.AUTH_SECRET ?? 'devsecret').update(JSON.stringify(payload)).digest('hex');

  const [handoff] = await db
    .insert(schema.lawyerHandoffs)
    .values({
      userId: user.id,
      lawyerId: lawyer.id,
      scanId: scanOwn.scan.id,
      signedPayload: { ...payload, sig },
    })
    .returning();

  // Email lawyer w/ signed link (Day-1: link not generated — payload only).
  await sendEmail(
    `${lawyer.firm ?? lawyer.name}@example.com`,
    `Clarifyd handoff from ${user.email}`,
    `<p>${user.email} wants a review of scan ${scanOwn.scan.id}. Health score ${scanOwn.scan.healthScore}.</p>`,
    user.email,
  ).catch(() => null);

  await db.update(schema.lawyerHandoffs).set({ deliveredAt: new Date() }).where(eq(schema.lawyerHandoffs.id, handoff.id));
  return Response.json({ handoffId: handoff.id });
}

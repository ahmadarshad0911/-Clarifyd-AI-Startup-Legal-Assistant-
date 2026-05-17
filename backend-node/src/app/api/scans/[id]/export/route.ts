import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { appendAudit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { exportDocx, exportPdf, exportTxt, spliceText } from '@/lib/export';
import { extractText } from '@/lib/pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({ format: z.enum(['pdf', 'docx', 'txt', 'clipboard']) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'format required' }, { status: 400 });

  const [own] = await db
    .select({ scan: schema.scans, contract: schema.contracts })
    .from(schema.scans)
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(and(eq(schema.scans.id, id), eq(schema.contracts.userId, user.id)));
  if (!own) return Response.json({ error: 'not found' }, { status: 404 });

  const accepted = await db
    .select()
    .from(schema.findings)
    .where(and(eq(schema.findings.scanId, id), eq(schema.findings.userDecision, 'accepted')));

  const buf = own.contract.fileBytes
    ? Buffer.from(own.contract.fileBytes as Buffer)
    : Buffer.from(await (await fetch(own.contract.blobUrl)).arrayBuffer());
  const { text } = await extractText(buf);

  const edits = accepted
    .filter((f) => f.rewriteText)
    .map((f) => {
      const start = text.indexOf(f.originalText);
      return start >= 0 ? { start, end: start + f.originalText.length, replacement: f.userEdit ?? f.rewriteText! } : null;
    })
    .filter((e): e is { start: number; end: number; replacement: string } => e !== null);

  const spliced = edits.length > 0 ? spliceText({ originalText: text, edits }) : text;

  let outBuf: Buffer;
  let contentType: string;
  let ext: string;
  if (parsed.data.format === 'clipboard') {
    await appendAudit(id, 'export', { format: 'clipboard', edits: edits.length, bytes: spliced.length });
    return Response.json({ text: spliced, edits: edits.length });
  }

  if (parsed.data.format === 'docx') {
    outBuf = await exportDocx(spliced);
    contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    ext = 'docx';
  } else if (parsed.data.format === 'pdf') {
    outBuf = await exportPdf(spliced);
    contentType = 'application/pdf';
    ext = 'pdf';
  } else {
    outBuf = exportTxt(spliced);
    contentType = 'text/plain';
    ext = 'txt';
  }

  // Inline download (data URL) — avoids Blob dependency.
  await appendAudit(id, 'export', { format: parsed.data.format, edits: edits.length, bytes: outBuf.length });
  return new Response(new Uint8Array(outBuf), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="clarifyd-${id}.${ext}"`,
      'Content-Length': String(outBuf.length),
    },
  });
}

import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';
import { sha256 } from '@/lib/hash';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await requireUser();
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'file required' }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return Response.json({ error: 'max 15MB' }, { status: 413 });
  const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type)) return Response.json({ error: 'PDF or DOCX only' }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());
  const digest = sha256(buf);

  const [row] = await db
    .insert(schema.contracts)
    .values({
      userId: user.id,
      filename: file.name,
      blobUrl: '',
      fileBytes: buf,
      sha256: digest,
    })
    .returning({ id: schema.contracts.id, sha256: schema.contracts.sha256 });

  return Response.json({ contractId: row.id, sha256: row.sha256, bytes: buf.length }, { status: 201 });
}

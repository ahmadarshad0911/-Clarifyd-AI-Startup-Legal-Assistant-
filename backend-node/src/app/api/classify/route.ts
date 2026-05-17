import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';
import { callKimi, sanitizeClauseText } from '@/lib/kimi';
import { extractText } from '@/lib/pdf';
import { redis } from '@/lib/redis';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TYPES = ['SAFE', 'NDA', 'MSA', 'TermSheet', 'Founders', 'Employment', 'Vendor', 'DPA', 'SaaSSub', 'EquityGrant', 'ConvertibleNote', 'IPAssignment'] as const;

const Body = z.object({ contractId: z.string().uuid() });

export async function POST(req: Request) {
  const user = await requireUser();
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: 'contractId required' }, { status: 400 });

  const [c] = await db
    .select()
    .from(schema.contracts)
    .where(and(eq(schema.contracts.id, parsed.data.contractId), eq(schema.contracts.userId, user.id)));
  if (!c) return Response.json({ error: 'not found' }, { status: 404 });

  const cacheKey = `classify:${c.sha256}`;
  const cached = process.env.UPSTASH_REDIS_REST_URL
    ? await redis.get<{ type: string; confidence: number }>(cacheKey).catch(() => null)
    : null;
  if (cached) {
    await db.update(schema.contracts).set({ docType: cached.type, docTypeConf: String(cached.confidence) }).where(eq(schema.contracts.id, c.id));
    return Response.json({ ...cached, cached: true });
  }

  // Extract real text from PDF/DOCX bytes (or fetch from Blob if URL set).
  const buf = c.fileBytes
    ? Buffer.from(c.fileBytes as Buffer)
    : Buffer.from(await (await fetch(c.blobUrl)).arrayBuffer());
  const { text } = await extractText(buf);
  const sample = sanitizeClauseText(text.slice(0, 6000));

  const reply = await callKimi(
    [
      { role: 'system', content: `Classify the contract into exactly one of: ${TYPES.join('|')}. Reply strict JSON: {"type":"...","confidence":0..1}` },
      { role: 'user', content: sample },
    ],
    { temperature: 0.0, maxTokens: 80 },
  );
  let out: { type: string; confidence: number };
  try {
    out = JSON.parse(reply.replace(/^```(json)?|```$/g, '').trim());
  } catch {
    out = { type: 'SAFE', confidence: 0.3 };
  }
  if (!TYPES.includes(out.type as typeof TYPES[number])) out = { type: 'SAFE', confidence: Math.min(out.confidence, 0.4) };

  if (process.env.UPSTASH_REDIS_REST_URL) {
    await redis.set(cacheKey, out, { ex: 60 * 60 * 24 * 30 }).catch(() => null);
  }
  await db.update(schema.contracts).set({ docType: out.type, docTypeConf: String(out.confidence) }).where(eq(schema.contracts.id, c.id));
  return Response.json({ ...out, alternatives: [] });
}

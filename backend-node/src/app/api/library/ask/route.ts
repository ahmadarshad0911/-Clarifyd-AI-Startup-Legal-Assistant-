import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';
import { embed } from '@/lib/embeddings';
import { callKimi } from '@/lib/kimi';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({ question: z.string().min(3).max(500) });

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'question required' }, { status: 400 });

  const qVec = await embed(parsed.data.question, 'query');
  const vecLiteral = `[${qVec.join(',')}]`;

  // Cosine distance via pgvector `<=>` operator. Lower = closer.
  const rows = await db.execute(
    sql`SELECT id, scan_id, chunk, metadata, embedding <=> ${vecLiteral}::vector AS distance
        FROM scan_embeddings
        WHERE user_id = ${user.id}
        ORDER BY embedding <=> ${vecLiteral}::vector
        LIMIT 6`,
  );
  const ctx = (rows as unknown as { rows: Array<{ chunk: string }> }).rows ?? [];
  const context = ctx.map((r, i) => `[${i + 1}] ${r.chunk}`).join('\n\n');

  const answer = await callKimi(
    [
      { role: 'system', content: 'Answer ONLY from the provided context. Cite chunk numbers like [1].' },
      { role: 'user', content: `Question: ${parsed.data.question}\n\nContext:\n${context}` },
    ],
    { temperature: 0.2, maxTokens: 500 },
  );
  return Response.json({ answer, citations: ctx.length });
}

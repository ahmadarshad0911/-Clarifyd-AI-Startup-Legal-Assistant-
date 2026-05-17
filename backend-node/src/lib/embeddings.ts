// Embeddings via NVIDIA NIM. Uses an embedding model (configure NIM_EMBED_MODEL_ID).
// Fallback: deterministic pseudo-vector (zeros + length signal) so dev works w/o credits.

const DIM = 1024;

export async function embed(text: string, inputType: 'query' | 'passage' = 'passage'): Promise<number[]> {
  const url = process.env.NIM_EMBED_URL ?? process.env.NIM_API_URL?.replace('/chat/completions', '/embeddings');
  const key = process.env.NIM_API_KEY;
  const model = process.env.NIM_EMBED_MODEL_ID;
  if (!url || !key || !model) return Array.from({ length: DIM }, (_, i) => (i < text.length % DIM ? 0.001 : 0));

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text.slice(0, 8000), input_type: inputType }),
  });
  if (!res.ok) {
    console.warn(`embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return new Array(DIM).fill(0);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data[0]?.embedding ?? new Array(DIM).fill(0);
}

// Naive chunker for clause text → embedding rows.
export const chunk = (text: string, max = 800): string[] => {
  const out: string[] = [];
  let buf = '';
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if ((buf + ' ' + sentence).length > max) {
      if (buf) out.push(buf);
      buf = sentence;
    } else {
      buf = buf ? buf + ' ' + sentence : sentence;
    }
  }
  if (buf) out.push(buf);
  return out;
};

import pdfParse from 'pdf-parse';

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
const clean = (s: string) => s.replace(/ /g, '').replace(/[ \t]+/g, ' ').trim();

// Extracts text from PDF/DOCX or falls back to UTF-8 decode for plain text bodies.
// pdf-parse throws on malformed PDFs; we recover via best-effort text extraction.
export async function extractText(buf: Buffer): Promise<{ text: string; words: number }> {
  const isPdf = buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-';
  if (isPdf) {
    try {
      const { text } = await pdfParse(buf);
      const out = clean(text);
      if (out.length > 0) return { text: out, words: wordCount(out) };
    } catch (err) {
      console.warn('pdf-parse failed, falling back:', String(err).slice(0, 120));
    }
  }
  // Fallback 1: extract text inside `(...) Tj` PDF operators.
  const raw = buf.toString('utf8');
  const tj = [...raw.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g)].map((m) =>
    m[1].replace(/\\([()\\])/g, '$1'),
  );
  if (tj.length > 0) {
    const joined = clean(tj.join('\n'));
    return { text: joined, words: wordCount(joined) };
  }
  // Fallback 2: strip non-printable, return rest.
  const printable = clean(raw.replace(/[^\x20-\x7E\n\r\t]/g, ' '));
  return { text: printable, words: wordCount(printable) };
}

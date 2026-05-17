// Byte-identical splice: replace only accepted clauses, rest preserved.
// Operates on extracted text + character offsets stored alongside findings.
// PDF re-render uses simple monospace; DOCX uses `docx` lib; TXT is raw.

import { Document, Packer, Paragraph } from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface SpliceInput {
  originalText: string;
  edits: Array<{ start: number; end: number; replacement: string }>;
}

// Apply edits right-to-left so offsets stay valid.
export function spliceText({ originalText, edits }: SpliceInput): string {
  const ordered = [...edits].sort((a, b) => b.start - a.start);
  let out = originalText;
  for (const e of ordered) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  return out;
}

export async function exportDocx(text: string): Promise<Buffer> {
  const doc = new Document({
    sections: [
      { children: text.split(/\n+/).map((p) => new Paragraph({ text: p })) },
    ],
  });
  return Packer.toBuffer(doc);
}

export function exportTxt(text: string): Buffer {
  return Buffer.from(text, 'utf8');
}

// Real PDF rendering via pdf-lib. US Letter, Helvetica 10pt, word-wrapped.
export async function exportPdf(text: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  const margin = 54; // 0.75in
  const pageW = 612;
  const pageH = 792;
  const lineHeight = fontSize * 1.4;
  const maxLineWidth = pageW - margin * 2;

  // Word-wrap a paragraph at the page width.
  const wrap = (line: string): string[] => {
    const out: string[] = [];
    const words = line.split(/\s+/);
    let buf = '';
    for (const w of words) {
      const trial = buf ? buf + ' ' + w : w;
      if (font.widthOfTextAtSize(trial, fontSize) <= maxLineWidth) buf = trial;
      else {
        if (buf) out.push(buf);
        buf = w;
      }
    }
    if (buf) out.push(buf);
    return out.length ? out : [''];
  };

  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;
  for (const para of text.split(/\n/)) {
    for (const wrapped of wrap(para)) {
      if (y < margin) {
        page = pdf.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(wrapped, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
      y -= lineHeight;
    }
  }
  return Buffer.from(await pdf.save());
}

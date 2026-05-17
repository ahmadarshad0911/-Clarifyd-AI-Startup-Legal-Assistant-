// Generate a synthetic SAFE-style PDF w/ risky clauses for smoke testing.
// No external lib — minimal hand-rolled single-page PDF.

import { writeFileSync } from 'node:fs';

const TEXT = [
  'SIMPLE AGREEMENT FOR FUTURE EQUITY (SAFE) — synthetic test document.',
  '',
  '1. LIABILITY CAP. In no event shall the Company\'s aggregate liability to the',
  '   Investor exceed one hundred dollars ($100), regardless of cause or theory',
  '   of liability, including negligence, strict liability, or breach of contract.',
  '',
  '2. IP ASSIGNMENT. The Founder hereby assigns all right, title, and interest in',
  '   any and all intellectual property, whether created before or after the date',
  '   of this Agreement, to the Company. This assignment is irrevocable.',
  '',
  '3. NON-COMPETE. The Founder shall not, directly or indirectly, compete with',
  '   the Company anywhere in the world for a period of five (5) years following',
  '   termination of service for any reason.',
  '',
  '4. INDEMNIFICATION. The Founder agrees to indemnify and hold harmless the',
  '   Company, its officers, directors, and affiliates from any and all claims,',
  '   damages, losses, or expenses arising from any breach by the Founder.',
  '',
  '5. GOVERNING LAW. This Agreement shall be governed by the laws of the State',
  '   of Delaware, without regard to its conflict of laws principles.',
  '',
  '6. CONFIDENTIALITY. The parties shall keep all confidential information,',
  '   including this Agreement, strictly confidential in perpetuity.',
];

const content = TEXT.join('\n');

// Minimal PDF (single page, Helvetica, text stream).
function buildPdf(body: string): Buffer {
  const lines = body.split('\n');
  const stream =
    'BT\n/F1 10 Tf\n12 TL\n50 780 Td\n' +
    lines.map((l) => `(${l.replace(/[\\()]/g, (m) => '\\' + m)}) Tj T*`).join('\n') +
    '\nET';

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj',
  );
  objects.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`);
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const o of objects) {
    offsets.push(Buffer.byteLength(out, 'binary'));
    out += o + '\n';
  }
  const xrefOffset = Buffer.byteLength(out, 'binary');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += String(off).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(out, 'binary');
}

writeFileSync('sample.pdf', buildPdf(content));
console.log('wrote sample.pdf', content.length, 'chars');

// MVP heuristic clause tagger.
// Splits document into clauses by numbered headers or double-newline blocks,
// then labels each block by keyword match. Defer ML classifier to Week 1.

export interface RawClause {
  clauseId: string;       // taxonomy key
  text: string;           // original verbatim
  charStart: number;      // for byte-identical splicing on export
  charEnd: number;
}

const TAXONOMY: Array<{ id: string; keywords: RegExp[] }> = [
  { id: 'LIABILITY_CAP', keywords: [/aggregate liability/i, /liability.*shall not exceed/i, /cap on liability/i] },
  { id: 'IP_ASSIGNMENT', keywords: [/assigns? all (?:right|title|interest)/i, /work product/i, /intellectual property.*assign/i] },
  { id: 'NON_COMPETE', keywords: [/non[- ]compete/i, /shall not (?:directly|indirectly) compete/i] },
  { id: 'NON_SOLICIT', keywords: [/non[- ]solicit/i, /shall not solicit/i] },
  { id: 'CONFIDENTIALITY', keywords: [/confidential information/i, /non[- ]disclosure/i] },
  { id: 'INDEMNITY', keywords: [/indemnif(?:y|ies|ication)/i, /hold harmless/i] },
  { id: 'TERMINATION', keywords: [/terminat(?:e|ion)/i, /may be terminated/i] },
  { id: 'GOVERNING_LAW', keywords: [/governing law/i, /governed by the laws? of/i] },
  { id: 'ARBITRATION', keywords: [/binding arbitration/i, /jams|aaa rules/i] },
  { id: 'PAYMENT_TERMS', keywords: [/net 30|net 60|net 90/i, /payment.*due/i] },
  { id: 'VESTING', keywords: [/vesting/i, /cliff/i, /accelerat(?:ion|ed)/i] },
  { id: 'CHANGE_OF_CONTROL', keywords: [/change of control/i, /acquisition/i] },
];

const splitBlocks = (text: string): Array<{ text: string; start: number; end: number }> => {
  const blocks: Array<{ text: string; start: number; end: number }> = [];
  const re = /(?:\n\s*\n|\r\n\s*\r\n)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const chunk = text.slice(last, m.index).trim();
    if (chunk.length > 60) blocks.push({ text: chunk, start: last, end: m.index });
    last = re.lastIndex;
  }
  const tail = text.slice(last).trim();
  if (tail.length > 60) blocks.push({ text: tail, start: last, end: text.length });
  return blocks;
};

export function tagClauses(text: string): RawClause[] {
  const blocks = splitBlocks(text);
  const out: RawClause[] = [];
  for (const b of blocks) {
    for (const t of TAXONOMY) {
      if (t.keywords.some((rx) => rx.test(b.text))) {
        out.push({ clauseId: t.id, text: b.text, charStart: b.start, charEnd: b.end });
        break;
      }
    }
  }
  return out;
}

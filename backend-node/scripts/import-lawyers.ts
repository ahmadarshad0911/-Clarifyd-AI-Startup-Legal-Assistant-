// CSV bulk-import for lawyer directory.
// Usage: npx tsx scripts/import-lawyers.ts path/to/lawyers.csv
// CSV columns (header row required):
//   name,firm,email,jurisdictions,flatFeeUsd,hourlyUsd,avatarUrl
// `jurisdictions` is pipe-separated: US|UK|EU

import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { readFile } from 'node:fs/promises';

const main = async () => {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: npx tsx scripts/import-lawyers.ts path/to/lawyers.csv');
    process.exit(1);
  }
  const raw = await readFile(path, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    console.error('CSV needs header row + at least 1 data row');
    process.exit(1);
  }
  const header = lines[0].split(',').map((s) => s.trim());
  const required = ['name', 'jurisdictions'];
  for (const r of required) {
    if (!header.includes(r)) {
      console.error(`missing required column: ${r}`);
      process.exit(1);
    }
  }
  const idx = (k: string) => header.indexOf(k);

  const { db, schema } = await import('../src/db');
  let inserted = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < header.length) continue;
    const row = {
      name: cols[idx('name')],
      firm: idx('firm') >= 0 ? cols[idx('firm')] || null : null,
      email: idx('email') >= 0 ? cols[idx('email')] || null : null,
      jurisdictions: cols[idx('jurisdictions')].split('|').filter(Boolean),
      flatFeeUsd: idx('flatFeeUsd') >= 0 && cols[idx('flatFeeUsd')] ? Number(cols[idx('flatFeeUsd')]) : null,
      hourlyUsd: idx('hourlyUsd') >= 0 && cols[idx('hourlyUsd')] ? Number(cols[idx('hourlyUsd')]) : null,
      avatarUrl: idx('avatarUrl') >= 0 ? cols[idx('avatarUrl')] || null : null,
    };
    await db.insert(schema.lawyers).values(row).onConflictDoNothing();
    inserted++;
  }
  console.log(`imported ${inserted} lawyers`);
};

// Minimal CSV parser: handles quoted fields w/ commas, escaped quotes.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else if (ch === '"') inQuote = false;
      else buf += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ',') {
        out.push(buf.trim());
        buf = '';
      } else buf += ch;
    }
  }
  out.push(buf.trim());
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

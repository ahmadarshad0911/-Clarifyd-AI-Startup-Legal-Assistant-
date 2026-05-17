import 'dotenv/config';
import { config } from 'dotenv';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from '@neondatabase/serverless';

config({ path: '.env.local', override: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  const dir = 'drizzle';
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    console.log('applying', f);
    const raw = await readFile(join(dir, f), 'utf8');
    const statements = raw
      .split(/-->\s*statement-breakpoint/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already exists/i.test(msg)) {
          console.log('  skip (exists):', stmt.slice(0, 60).replace(/\s+/g, ' '));
          continue;
        }
        console.error('  FAILED:', stmt.slice(0, 120).replace(/\s+/g, ' '));
        throw err;
      }
    }
  }
  await pool.end();
  console.log('migrate complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { Pool } from '@neondatabase/serverless';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  console.log('listing tables...');
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  );
  console.log(`found ${rows.length} tables`);
  for (const r of rows) {
    console.log('  drop', r.tablename);
    await pool.query(`DROP TABLE IF EXISTS "${r.tablename}" CASCADE`);
  }
  console.log('extensions...');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query('CREATE EXTENSION IF NOT EXISTS citext');
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  // Verify empty
  const { rows: after } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public'`,
  );
  console.log(`remaining: ${after.length}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import 'dotenv/config';
import { config } from 'dotenv';
import { Pool } from '@neondatabase/serverless';

config({ path: '.env.local', override: true });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
  );
  console.log(rows.map((r) => r.table_name).join('\n'));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

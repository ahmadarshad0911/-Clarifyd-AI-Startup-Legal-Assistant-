import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const juris = url.searchParams.get('jurisdiction')?.toUpperCase();
  const rows = await db
    .select({
      id: schema.lawyers.id,
      name: schema.lawyers.name,
      firm: schema.lawyers.firm,
      flatFeeUsd: schema.lawyers.flatFeeUsd,
      avatarUrl: schema.lawyers.avatarUrl,
      jurisdictions: schema.lawyers.jurisdictions,
    })
    .from(schema.lawyers)
    .where(
      juris
        ? and(eq(schema.lawyers.active, true), sql`${schema.lawyers.jurisdictions} && ARRAY[${juris}]::text[]`)
        : eq(schema.lawyers.active, true),
    );
  return Response.json(rows);
}

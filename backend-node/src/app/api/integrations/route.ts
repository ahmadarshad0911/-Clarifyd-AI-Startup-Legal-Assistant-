import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';
import { PROVIDERS } from '@/lib/integrations';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireUser();
  const rows = await db
    .select({ provider: schema.integrations.provider, createdAt: schema.integrations.createdAt })
    .from(schema.integrations)
    .where(eq(schema.integrations.userId, user.id));
  const connected = new Set(rows.map((r) => r.provider));
  return Response.json(
    PROVIDERS.map((p) => ({
      provider: p,
      status: connected.has(p) ? 'connected' : 'disconnected',
      connectedAt: rows.find((r) => r.provider === p)?.createdAt ?? null,
    })),
  );
}

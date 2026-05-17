import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';
import { PROVIDERS, type Provider } from '@/lib/integrations';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const user = await requireUser();
  const { provider } = await params;
  if (!PROVIDERS.includes(provider as Provider)) return Response.json({ error: 'unknown provider' }, { status: 400 });
  await db
    .delete(schema.integrations)
    .where(and(eq(schema.integrations.userId, user.id), eq(schema.integrations.provider, provider)));
  return Response.json({ ok: true });
}

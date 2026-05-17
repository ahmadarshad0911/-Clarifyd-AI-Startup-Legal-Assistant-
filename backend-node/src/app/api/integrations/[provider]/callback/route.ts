import { db, schema } from '@/db';
import { exchangeCode, PROVIDERS, type Provider } from '@/lib/integrations';
import { redis } from '@/lib/redis';
import { encrypt } from '@/lib/vault';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!PROVIDERS.includes(provider as Provider)) return Response.json({ error: 'unknown provider' }, { status: 400 });
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return Response.json({ error: 'missing code/state' }, { status: 400 });

  const session = await redis.get<{ userId: string; provider: string }>(`oauth:state:${state}`);
  if (!session || session.provider !== provider) return Response.json({ error: 'state mismatch' }, { status: 400 });
  await redis.del(`oauth:state:${state}`);

  const { accessToken, refreshToken } = await exchangeCode(provider as Provider, code);
  await db
    .insert(schema.integrations)
    .values({
      userId: session.userId,
      provider,
      accessToken: encrypt(accessToken),
      refreshToken: refreshToken ? encrypt(refreshToken) : null,
      config: {},
    })
    .onConflictDoUpdate({
      target: [schema.integrations.userId, schema.integrations.provider],
      set: {
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
      },
    });
  return Response.redirect(`${process.env.APP_URL ?? 'http://localhost:3001'}/integrations?connected=${provider}`, 302);
}

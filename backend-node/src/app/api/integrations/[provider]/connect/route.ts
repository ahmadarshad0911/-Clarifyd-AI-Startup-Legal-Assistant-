import { randomBytes } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { authorizeUrl, PROVIDERS, type Provider } from '@/lib/integrations';
import { redis } from '@/lib/redis';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const user = await requireUser();
  const { provider } = await params;
  if (!PROVIDERS.includes(provider as Provider)) return Response.json({ error: 'unknown provider' }, { status: 400 });
  const state = randomBytes(24).toString('hex');
  await redis.set(`oauth:state:${state}`, { userId: user.id, provider }, { ex: 600 });
  return Response.redirect(authorizeUrl(provider as Provider, state), 302);
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { PROVIDERS, type Provider } from '@/lib/integrations';

export const runtime = 'nodejs';

// Slack signs every request: X-Slack-Signature = v0=hex(hmac_sha256(secret, "v0:ts:body")).
// Reject if timestamp > 5 min old (replay protection).
function verifySlack(req: Request, body: string, signature: string | null, ts: string | null): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !signature || !ts) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const base = `v0:${ts}:${body}`;
  const mac = 'v0=' + createHmac('sha256', secret).update(base).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!PROVIDERS.includes(provider as Provider)) return Response.json({ error: 'unknown' }, { status: 400 });

  const body = await req.text();

  if (provider === 'slack') {
    const ok = verifySlack(
      req,
      body,
      req.headers.get('x-slack-signature'),
      req.headers.get('x-slack-request-timestamp'),
    );
    if (!ok) return Response.json({ error: 'bad signature' }, { status: 401 });
    // Slack URL verification challenge
    try {
      const json = JSON.parse(body) as { type?: string; challenge?: string };
      if (json.type === 'url_verification' && json.challenge) {
        return Response.json({ challenge: json.challenge });
      }
    } catch {
      // not JSON; ignore
    }
  }

  console.log('webhook', provider, body.slice(0, 200));
  return Response.json({ ok: true });
}

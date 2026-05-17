// DEV-ONLY: bypass magic-link auth. Issues a real Auth.js session cookie
// for the seeded demo user. Gated by DEV_AUTH_BYPASS=1.

import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';

export const runtime = 'nodejs';

const COOKIE_NAME = 'authjs.session-token';

export async function GET(req: Request) {
  if (process.env.DEV_AUTH_BYPASS !== '1') {
    return Response.json({ error: 'disabled' }, { status: 403 });
  }
  const url = new URL(req.url);
  const email = url.searchParams.get('email') ?? 'demo@clarifyd.dev';

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user) return Response.json({ error: `no user ${email}` }, { status: 404 });

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 86400_000);

  await db.insert(schema.sessions).values({ sessionToken: token, userId: user.id, expires });

  const isProd = process.env.NODE_ENV === 'production';
  return new Response(JSON.stringify({ ok: true, userId: user.id, email: user.email, expires }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': [
        `${COOKIE_NAME}=${token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Expires=${expires.toUTCString()}`,
        ...(isProd ? ['Secure'] : []),
      ].join('; '),
    },
  });
}

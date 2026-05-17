import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auth } from '@/lib/auth';

// Admin gate: user.plan must be 'admin'. Set via direct DB UPDATE or seed.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Response('unauthorized', { status: 401 });
  const [u] = await db
    .select({ plan: schema.users.plan, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id));
  if (u?.plan !== 'admin') throw new Response('forbidden', { status: 403 });
  return { id: session.user.id, email: u.email };
}

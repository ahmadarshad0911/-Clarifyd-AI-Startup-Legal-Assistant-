import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { db, schema } from '@/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM ?? 'auth@clarifyd.dev',
    }),
  ],
  session: { strategy: 'database' },
  trustHost: true,
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Response('unauthorized', { status: 401 });
  return session.user as { id: string; email: string };
}

import { z } from 'zod';
import { db, schema } from '@/db';
import { auth } from '@/lib/auth';
import { sha256 } from '@/lib/hash';

export const runtime = 'nodejs';

const Body = z.object({
  choice: z.enum(['accept-all', 'essential-only', 'custom']),
  details: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: 'choice required' }, { status: 400 });

  const session = await auth();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';

  await db.insert(schema.consentEvents).values({
    userId: session?.user?.id ?? null,
    ipHash: sha256(ip),
    choice: parsed.data.choice,
    details: parsed.data.details ?? null,
  });
  return Response.json({ ok: true }, { status: 201 });
}

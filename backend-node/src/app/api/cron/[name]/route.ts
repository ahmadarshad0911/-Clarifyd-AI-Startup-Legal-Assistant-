// Vercel Cron fallback (used when Inngest is not configured).
// Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}`.

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { DEFAULT_SOURCES, diffRegulationSource, flagAffectedScans } from '@/lib/regulation';

export const runtime = 'nodejs';
export const maxDuration = 300;

const handlers: Record<string, () => Promise<unknown>> = {
  'deadline-fire': async () => ({ note: 'use inngest deadline.fire' }),
  'regulation-diff': async () => {
    const out: Record<string, unknown> = {};
    for (const s of DEFAULT_SOURCES) {
      out[s.source] = await diffRegulationSource(s);
      await flagAffectedScans(s.source);
    }
    return out;
  },
  'retention-sweep': async () => {
    const cutoff = new Date(Date.now() - 30 * 86400_000);
    const r = await db.execute(sql`UPDATE contracts SET deleted_at = NOW(), file_bytes = NULL
                                   WHERE deleted_at IS NULL AND last_accessed_at < ${cutoff}`);
    return { swept: (r as { rowCount?: number }).rowCount ?? 0 };
  },
  'playbook-refresh': async () => ({ ok: true }),
  'weekly-digest': async () => ({ ok: true, note: 'use inngest weekly.digest' }),
};

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { name } = await params;
  const fn = handlers[name];
  if (!fn) return Response.json({ error: 'unknown cron' }, { status: 404 });
  const result = await fn();
  return Response.json({ name, result });
}

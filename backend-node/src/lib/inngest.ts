import { and, eq, lte, sql } from 'drizzle-orm';
import { Inngest } from 'inngest';
import { db, schema } from '@/db';
import { decrypt } from './vault';
import { postToSlack } from './integrations/slack';
import { sendGmail } from './integrations/gmail';
import { runScan } from './scan-runner';
import { DEFAULT_SOURCES, diffRegulationSource, flagAffectedScans } from './regulation';
import { sendEmail } from './email';

export const inngest = new Inngest({ id: 'clarifyd-backend' });

// scan.run — replaces fire-and-forget call in /api/scans
export const scanRunFn = inngest.createFunction(
  { id: 'scan.run', retries: 2 },
  { event: 'scan/run' },
  async ({ event, step }) => {
    await step.run('run', () => runScan(event.data.scanId as string));
    return { ok: true };
  },
);

// deadline.fire — hourly
export const deadlineFireFn = inngest.createFunction(
  { id: 'deadline.fire' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const due = await step.run('find-due', async () =>
      db
        .select()
        .from(schema.deadlines)
        .where(and(eq(schema.deadlines.status, 'active'), lte(schema.deadlines.dueAt, new Date(Date.now() + 86400_000)))),
    );
    for (const d of due) {
      if (!d.userId) continue;
      const integ = await db
        .select()
        .from(schema.integrations)
        .where(and(eq(schema.integrations.userId, d.userId), eq(schema.integrations.provider, 'slack')));
      for (const i of integ) {
        const token = decrypt(Buffer.from(i.accessToken));
        const channel = (i.config as { channel?: string } | null)?.channel ?? '#general';
        await step.run(`slack-${d.id}`, () => postToSlack(token, channel, `Clarifyd: ${d.label}`));
      }
    }
    return { fired: due.length };
  },
);

// regulation.diff — daily 02:00 UTC
export const regulationDiffFn = inngest.createFunction(
  { id: 'regulation.diff' },
  { cron: '0 2 * * *' },
  async ({ step }) => {
    const out: Record<string, unknown> = {};
    for (const s of DEFAULT_SOURCES) {
      out[s.source] = await step.run(`fetch-${s.source}`, () => diffRegulationSource(s));
      await step.run(`flag-${s.source}`, () => flagAffectedScans(s.source));
    }
    return out;
  },
);

// retention.sweep — daily 03:00 UTC
export const retentionSweepFn = inngest.createFunction(
  { id: 'retention.sweep' },
  { cron: '0 3 * * *' },
  async () => {
    const cutoff = new Date(Date.now() - 30 * 86400_000);
    const result = await db.execute(
      sql`UPDATE contracts SET deleted_at = NOW(), file_bytes = NULL
          WHERE deleted_at IS NULL AND last_accessed_at < ${cutoff}`,
    );
    return { swept: (result as unknown as { rowCount?: number }).rowCount ?? 0 };
  },
);

// playbook.refresh — weekly Sunday 04:00 UTC
export const playbookRefreshFn = inngest.createFunction(
  { id: 'playbook.refresh' },
  { cron: '0 4 * * 0' },
  async () => {
    // Recompute median/p25/p75 across user's scans.
    // Day-1: noop. Wire ETL once corpus exists.
    return { ok: true, note: 'corpus-empty' };
  },
);

// weekly.digest — Mondays 09:00 UTC
export const weeklyDigestFn = inngest.createFunction(
  { id: 'weekly.digest' },
  { cron: '0 9 * * 1' },
  async ({ step }) => {
    const targets = await step.run('list', async () =>
      db
        .select({ userId: schema.weeklyDigestState.userId, email: schema.users.email })
        .from(schema.weeklyDigestState)
        .innerJoin(schema.users, eq(schema.weeklyDigestState.userId, schema.users.id))
        .where(eq(schema.weeklyDigestState.enabled, true)),
    );
    const weekAgo = new Date(Date.now() - 7 * 86400_000);
    let sent = 0;
    for (const t of targets) {
      await step.run(`send-${t.userId}`, async () => {
        // Aggregate this week's activity
        const scans = await db
          .select({
            id: schema.scans.id,
            score: schema.scans.healthScore,
            critical: schema.scans.criticalN,
            high: schema.scans.highN,
            filename: schema.contracts.filename,
            finishedAt: schema.scans.finishedAt,
          })
          .from(schema.scans)
          .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
          .where(and(eq(schema.contracts.userId, t.userId), eq(schema.scans.status, 'done')));
        const week = scans.filter((s) => s.finishedAt && s.finishedAt > weekAgo);
        const upcoming = await db
          .select()
          .from(schema.deadlines)
          .where(and(eq(schema.deadlines.userId, t.userId), eq(schema.deadlines.status, 'active')))
          .limit(5);

        const rows = week
          .map(
            (s) =>
              `<tr><td>${s.filename}</td><td>${s.score ?? '—'}</td><td>${s.critical ?? 0}</td><td>${s.high ?? 0}</td></tr>`,
          )
          .join('');
        const deadlineRows = upcoming
          .map((d) => `<li><strong>${d.label}</strong> — ${new Date(d.dueAt).toLocaleDateString()}</li>`)
          .join('');

        const html = `
<div style="font-family:system-ui;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:20px;margin:0 0 16px">Your Clarifyd weekly digest</h1>
  <p style="color:#555">${week.length} contract${week.length === 1 ? '' : 's'} scanned this week.</p>
  ${
    week.length > 0
      ? `<table cellpadding="8" style="width:100%;border-collapse:collapse;border:1px solid #eee">
           <thead><tr style="background:#fafafa"><th align="left">Contract</th><th>Score</th><th>Critical</th><th>High</th></tr></thead>
           <tbody>${rows}</tbody>
         </table>`
      : '<p style="color:#888">No scans this week.</p>'
  }
  ${upcoming.length > 0 ? `<h2 style="font-size:16px;margin-top:24px">Upcoming deadlines</h2><ul>${deadlineRows}</ul>` : ''}
  <p style="color:#888;font-size:12px;margin-top:32px">Reply STOP to disable digests. Clarifyd — decision support, not legal advice.</p>
</div>`;

        await sendEmail(t.email, 'Your Clarifyd weekly digest', html);
        await db
          .update(schema.weeklyDigestState)
          .set({ lastSentAt: new Date() })
          .where(eq(schema.weeklyDigestState.userId, t.userId));
        sent++;
      });
    }
    return { sent };
  },
);

// helper for unused-import suppression (sendGmail used by counter-proposal route)
export const _gmail = sendGmail;

export const functions = [
  scanRunFn,
  deadlineFireFn,
  regulationDiffFn,
  retentionSweepFn,
  playbookRefreshFn,
  weeklyDigestFn,
];

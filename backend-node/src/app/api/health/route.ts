// Deep health check. ?deep=1 pings DB + NIM, otherwise liveness only.

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deep = url.searchParams.get('deep') === '1';
  const out: Record<string, unknown> = { ok: true, ts: new Date().toISOString() };

  if (deep) {
    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');
    const checks: Record<string, { ok: boolean; ms: number; err?: string }> = {};

    // DB
    const t0 = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      checks.db = { ok: true, ms: Date.now() - t0 };
    } catch (e) {
      checks.db = { ok: false, ms: Date.now() - t0, err: String(e).slice(0, 120) };
    }

    // NIM
    const t1 = Date.now();
    try {
      const res = await fetch(process.env.NIM_API_URL!, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NIM_API_KEY!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.NIM_MODEL_ID!,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });
      checks.nim = { ok: res.ok, ms: Date.now() - t1, err: res.ok ? undefined : `status ${res.status}` };
    } catch (e) {
      checks.nim = { ok: false, ms: Date.now() - t1, err: String(e).slice(0, 120) };
    }

    out.checks = checks;
    out.ok = Object.values(checks).every((c) => c.ok);
  }

  return Response.json(out, { status: out.ok ? 200 : 503 });
}

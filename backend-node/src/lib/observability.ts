// Lightweight observability shim. Activates Sentry only if SENTRY_DSN set.
// Avoids adding the @sentry/nextjs install to package.json unless used.

type Tags = Record<string, string | number | boolean | null | undefined>;

interface SentryShim {
  init(opts: { dsn: string; tracesSampleRate: number; environment?: string }): void;
  captureException(err: unknown, ctx?: { tags?: Tags }): void;
  captureMessage(msg: string, ctx?: { tags?: Tags; level?: string }): void;
}

let sentryInited = false;
let sentryModule: SentryShim | null = null;

async function ensureSentry(): Promise<SentryShim | null> {
  if (sentryInited) return sentryModule;
  if (!process.env.SENTRY_DSN) {
    sentryInited = true;
    return null;
  }
  try {
    // Optional dep — only resolves if installed.
    const mod = (await import(/* @vite-ignore */ '@sentry/nextjs' as string).catch(() => null)) as SentryShim | null;
    if (mod) {
      mod.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, environment: process.env.NODE_ENV });
      sentryModule = mod;
    }
  } catch (err) {
    console.warn('sentry init failed:', String(err));
  }
  sentryInited = true;
  return sentryModule;
}

export async function captureException(err: unknown, tags?: Tags) {
  const s = await ensureSentry();
  if (s) s.captureException(err, { tags });
  else console.error('[err]', tags ?? {}, err);
}

export async function captureMessage(msg: string, tags?: Tags) {
  const s = await ensureSentry();
  if (s) s.captureMessage(msg, { tags, level: 'info' });
}

// Span shim for NIM calls. Works without Sentry; just timing log.
export async function trace<T>(name: string, fn: () => Promise<T>, tags?: Tags): Promise<T> {
  const start = Date.now();
  try {
    const out = await fn();
    const ms = Date.now() - start;
    if (ms > 500) console.log(`[trace] ${name} ${ms}ms`, tags ?? {});
    return out;
  } catch (err) {
    await captureException(err, { name, ...tags });
    throw err;
  }
}

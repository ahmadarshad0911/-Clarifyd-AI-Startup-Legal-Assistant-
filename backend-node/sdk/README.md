# Clarifyd Backend SDK

Thin typed client for the Clarifyd backend. Drop `sdk/index.ts` into your frontend at `src/lib/clarifyd.ts`.

## Same-origin (Path A — backend merged into frontend repo)
```ts
import { client } from '@/lib/clarifyd';

const me = await client.me();
const { contractId } = await client.contracts.upload(file);
const { scanId } = await client.scans.start(contractId);

// Live scan progress
const es = client.scans.stream(scanId);
es.addEventListener('finding_emit', (ev) => console.log(JSON.parse(ev.data)));
es.addEventListener('scan_done', () => es.close());

const { findings } = await client.scans.findings(scanId);
await client.clauses.decide(findings[0].id, 'accepted');
```

## Cross-origin (Path B — backend on separate Vercel project)
```ts
import { createClient } from '@/lib/clarifyd';
export const client = createClient({ baseUrl: process.env.NEXT_PUBLIC_API ?? 'https://clarifyd-backend.vercel.app' });
```
Backend must set CORS + `SameSite=None; Secure` cookies (see `../INTEGRATION.md` §B.2).

## Frameworks
The SDK uses standard `fetch` + `EventSource`. Works in React, Vue, Svelte, vanilla.

## Errors
```ts
import { ClarifydError } from '@/lib/clarifyd';

try { await client.me(); }
catch (e) {
  if (e instanceof ClarifydError && e.status === 401) { /* redirect to login */ }
}
```

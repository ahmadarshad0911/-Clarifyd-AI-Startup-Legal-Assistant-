# Integrating clarifyd-backend into the Clarifyd frontend repo

This standalone backend sits at `C:\Users\ahmed\clarifyd-backend`. To merge into the live Clarifyd repo (the one hosting https://clarifyd-ai-startup-legal-assistant.vercel.app), choose one of two paths.

## Path A — Same Vercel project (recommended)
Merge all routes into the existing Next.js app so frontend + backend share one deploy.

### 1. Copy files into the Clarifyd repo
From the Clarifyd repo root:
```bash
# Adjust paths if frontend uses /app at repo root
cp -r ../clarifyd-backend/src/app/api ./src/app/api
cp -r ../clarifyd-backend/src/lib    ./src/lib
cp -r ../clarifyd-backend/src/db     ./src/db
cp -r ../clarifyd-backend/drizzle    ./drizzle
cp    ../clarifyd-backend/drizzle.config.ts ./
cp    ../clarifyd-backend/vercel.json ./vercel.json     # or merge if you already have one
```

### 2. Merge dependencies
Add to the frontend's `package.json` `dependencies`:
```json
"@auth/drizzle-adapter": "^1.7.4",
"@upstash/ratelimit": "^2.0.5",
"@upstash/redis": "^1.34.3",
"@vercel/blob": "^2.3.3",
"@vercel/postgres": "^0.10.0",
"docx": "^9.0.3",
"drizzle-orm": "^0.36.4",
"inngest": "^3.27.0",
"next-auth": "5.0.0-beta.25",
"pdf-parse": "^1.1.1",
"resend": "^4.0.1",
"zod": "^3.23.8"
```
And `devDependencies`:
```json
"@types/pdf-parse": "^1.1.4",
"dotenv": "^17.4.2",
"drizzle-kit": "^0.28.1",
"tsx": "^4.19.2"
```
Run `npm install --legacy-peer-deps`.

### 3. Add env to Vercel project
In Vercel dashboard → Project → Settings → Environment Variables, add every key from `.env.example`. Minimum for prod:
- `DATABASE_URL` (Neon connection string)
- `NIM_API_URL`, `NIM_API_KEY`, `NIM_MODEL_ID=meta/llama-3.3-70b-instruct`
- `AUTH_SECRET` (`openssl rand -base64 32`)
- `VAULT_KEY` (`openssl rand -base64 32`)
- `RESEND_API_KEY`, `RESEND_FROM` (for production magic links — replace DEV_AUTH_BYPASS)
- `APP_URL=https://clarifyd-ai-startup-legal-assistant.vercel.app`
- `CRON_SECRET` (random — used by `/api/cron/*`)

Do NOT set `DEV_AUTH_BYPASS` in production.

### 4. Apply DB schema
```bash
npm run db:push        # OR use scripts/migrate.ts for explicit control
npm run db:seed        # lawyers + playbook
```

### 5. Wire frontend to backend
Frontend components from `revamped-fronted.md` call these endpoints:
| Frontend component | Endpoint |
|---|---|
| HealthGauge / Findings | `GET /api/scans/{id}/findings` |
| Terminal demo (live scan) | `GET /api/scans/{id}/stream` (SSE) |
| ClauseCard accept | `PATCH /api/clauses/{id}` |
| ContextSelector | `GET\|PUT /api/user/context` |
| AutoClassifyChip | `POST /api/classify` |
| PlaybookCompare | `GET /api/compare/{scanId}?corpus=yc-w26` |
| DeadlineMonitor | `GET\|POST /api/monitor/deadlines` |
| LawyerEscapeHatch | `GET /api/lawyers?jurisdiction=US` |
| LawyerEscapeHatch submit | `POST /api/lawyer-handoff` |
| CounterProposalEmail tab | `GET /api/clauses/{id}/email-draft` |
| IntegrationsPanel | `GET /api/integrations` + `/connect`, `/disconnect` |
| TrustStrip | `GET /api/security/posture` |
| Audit chain viewer | `GET /api/audit/{scanId}` |
| Export button | `POST /api/scans/{id}/export` |
| Cookie banner | `POST /api/consent` |

All return JSON. SSE stream uses `EventSource('/api/scans/{id}/stream')` and emits events `scan_start | extract | finding_emit | scan_done | scan_error`.

### 6. Deploy
```bash
vercel --prod
```

Vercel Cron in `vercel.json` activates automatically. Inngest functions register on first hit to `/api/inngest` (visit it once to sync if using Inngest Cloud).

---

## Path B — Separate backend deploy
Keep `clarifyd-backend` as a standalone Vercel project. Frontend calls cross-origin.

### 1. Deploy backend as own project
```bash
cd C:\Users\ahmed\clarifyd-backend
vercel --prod   # link to new project, e.g. clarifyd-backend.vercel.app
```
Add envs in that project (same as Path A step 3).

### 2. Set CORS on backend
Add to `src/app/api/*` responses, OR add `middleware.ts` at repo root:
```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOW = ['https://clarifyd-ai-startup-legal-assistant.vercel.app', 'http://localhost:3000'];

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  const res = NextResponse.next();
  if (ALLOW.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  return res;
}

export const config = { matcher: '/api/:path*' };
```

### 3. Frontend: point fetches at backend origin
```ts
const API = process.env.NEXT_PUBLIC_API ?? 'https://clarifyd-backend.vercel.app';
fetch(`${API}/api/scans/${id}/findings`, { credentials: 'include' });
```
Cookies cross-origin require `SameSite=None; Secure` — patch `src/lib/auth.ts` cookie options accordingly and `src/app/api/dev/session/route.ts` (remove for prod).

### 4. Same DB
Both deploys point at the same Neon URL — no duplication.

---

## Known issues at handoff

1. **`/api/classify` returned empty** in smoke test — needs PDF text extraction before passing to model. Currently passes raw bytes as UTF-8 slice. Fix: run `extractText(buf)` in classify route the same way scan-runner does.
2. **`/api/scans/{id}/export` returned empty** — text-extract path for bytea-stored contracts is fine, but the clipboard branch returns `Response.json({text: spliced})` only if there are accepted clauses w/ rewrites. Verify spliced text non-empty.
3. **`scan.model` column hardcoded `kimi-k2`** — schema default. Update scan-runner to write actual `process.env.NIM_MODEL_ID`.
4. **Kimi K2 EOL** — currently on Llama 3.3 70b. When Kimi K2.5 / kimi-k2-instruct-0905 ships on NIM (if ever), swap back via env.
5. **Vercel Blob disabled** — using Postgres bytea instead. Fine for ≤15 MB contracts; switch back to Blob once a Public store can be created.

## Quick smoke after deploy
```bash
BASE=https://your-deploy.vercel.app
curl "$BASE/api/health"
curl "$BASE/api/security/posture"
# auth required for the rest — use real magic link in prod
```

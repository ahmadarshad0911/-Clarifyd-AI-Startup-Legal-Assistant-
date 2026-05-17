# Clarifyd Backend

Standalone Next.js 15 (App Router) backend. Implements ALL phases of `../clarifyd-docs/backend-plan.md` (Day-1 + W1 + W2 + W3 + W4 scaffolds).

## Stack
- Next.js 15 (API routes only)
- Drizzle ORM + Vercel Postgres + pgvector
- Vercel Blob (PDFs, exports, audit dumps)
- Auth.js v5 (magic-link via Resend)
- Inngest (background jobs) + Vercel Cron fallback
- Upstash Redis (token-bucket rate limit, OAuth state, classify cache)
- Kimi K2 via NVIDIA NIM HTTP
- AES-256-GCM vault for OAuth tokens

## Setup
```bash
cp .env.example .env.local        # fill all 20 envs
npm install
npm run db:push                   # apply schema (requires pgvector extension)
npm run db:seed                   # demo user + lawyers + playbook
npm run dev                       # http://localhost:3001
```

## Endpoints

### Day-1 (P0)
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/contracts` | Upload PDF/DOCX → Blob + DB |
| `POST` | `/api/scans` | Enqueue scan (Inngest or inline) |
| `GET`  | `/api/scans/{id}` | Snapshot |
| `GET`  | `/api/scans/{id}/findings` | Findings array |
| `GET`  | `/api/scans/{id}/stream` | SSE — drives terminal demo |
| `PATCH`| `/api/clauses/{id}` | Accept / reject / edit |
| `GET`  | `/api/audit/{scanId}` | Hash-chained events + verify |
| `POST` | `/api/consent` | Cookie consent log |
| `GET`  | `/api/health` | Liveness |
| `GET`  | `/api/auth/*` | Auth.js magic link |

### W1 (P0 completion)
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/classify` | Kimi-K2 contract-type classifier, cached by sha256 |
| `GET\|PUT` | `/api/user/context` | Persist jurisdiction/stage/role |
| `GET`  | `/api/security/posture` | Static cert/security posture for TrustStrip |

### W2 (P1)
| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/compare/{scanId}?corpus=yc-w26` | Playbook compare |
| `GET\|POST` | `/api/monitor/deadlines` | List / create deadlines |
| `PATCH`| `/api/monitor/deadlines/{id}` | Snooze / dismiss |
| `GET`  | `/api/clauses/{id}/email-draft` | Counter-proposal email |
| `GET`  | `/api/integrations` | Integration status list |
| `GET`  | `/api/integrations/{provider}/connect` | OAuth start |
| `GET`  | `/api/integrations/{provider}/callback` | OAuth finish |
| `POST` | `/api/integrations/{provider}/disconnect` | Revoke |
| `POST` | `/api/integrations/{provider}/webhook` | Inbound provider events |

### W3 (P2)
| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/lawyers?jurisdiction=US` | Vetted lawyer directory |
| `POST` | `/api/lawyer-handoff` | Signed JSON handoff + email |
| `POST` | `/api/library/ask` | Cross-contract Q&A (pgvector + Kimi) |
| `POST` | `/api/scans/{id}/export` | Byte-identical splice → PDF/DOCX/TXT/clipboard |

### W4 (harden)
| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/audit/{scanId}/export` | Signed audit JSON download |
| `*`    | `/api/inngest` | Inngest function host |
| `GET`  | `/api/cron/{name}` | Vercel Cron fallback (auth: `CRON_SECRET`) |

## Background jobs

| Job | Schedule | Action |
|---|---|---|
| `scan.run` | event-driven | classify → extract → tag → Kimi → findings → audit → embed |
| `deadline.fire` | hourly | dispatch via user's Slack/Gmail integration |
| `regulation.diff` | daily 02:00 UTC | RSS diff FTC/SEC → flag affected scans |
| `retention.sweep` | daily 03:00 UTC | soft-delete contracts past retention |
| `playbook.refresh` | weekly Sun 04:00 UTC | recompute p25/p50/p75 |
| `weekly.digest` | Mondays 09:00 UTC | Resend email per user |

## Security baseline
- AES-256-GCM helper (`src/lib/vault.ts`) used by integration OAuth tokens.
- Prompt-injection sentinels + role-impersonation stripper (`src/lib/kimi.ts:sanitizeClauseText`).
- `X-Kimi-Train: false` header on every NIM call.
- Hash-chained audit (`src/lib/audit.ts`); verify endpoint at `/api/audit/{scanId}`.
- Plan-tier rate limit: Postgres count (Day-1) → Upstash token bucket (W2+) automatically when `UPSTASH_REDIS_REST_URL` set.
- Ownership checks on every scan / finding / audit / export read.
- Lawyer-handoff payload HMAC-signed w/ `AUTH_SECRET`.

## Integration into Clarifyd Vercel repo
Copy `src/app/api/*`, `src/lib/*`, `src/db/*`, `drizzle/`, `drizzle.config.ts`, `vercel.json` into the Clarifyd repo at matching paths. Merge `package.json` dependencies. Add envs to Vercel project. Run `npm run db:push` then `npm run db:seed`.

## Open creds needed (blockers)
1. `DATABASE_URL` (Vercel Postgres) + pgvector extension enabled.
2. `BLOB_READ_WRITE_TOKEN` (Vercel Blob).
3. `NIM_API_URL` + `NIM_API_KEY` + `NIM_MODEL_ID` + (optional) `NIM_EMBED_MODEL_ID`.
4. `RESEND_API_KEY` + `RESEND_FROM` (verified domain).
5. `AUTH_SECRET`, `VAULT_KEY` — both `openssl rand -base64 32`.
6. `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (optional, falls back to Postgres ratelimit).
7. `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (optional, falls back to inline scan + Vercel Cron).
8. Slack / Google / Notion OAuth client id+secret (only needed for integration testing).
9. `CRON_SECRET` for Vercel Cron auth.
10. `APP_URL` for OAuth redirects.

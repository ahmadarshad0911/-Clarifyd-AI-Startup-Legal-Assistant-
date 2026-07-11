# Clarifyd — AI Startup Legal Assistant

> AI-assisted contract risk review for **pre-seed founders**. Upload a PDF / DOCX, get clause-level risk findings, founder-friendly rewrites, and an exportable redlined draft — without paying for an hour of legal counsel before you know the questions to ask.

**Status:** SLC (Simple, Loveable, Complete) — Week 2 backend + **Broadsheet v6** frontend (editorial / brutalist, ivory paper + ink + arterial red, Geist + Geist Mono, Phosphor duotone icons). Reasoning is exposed under the **Clarifyd AI** brand; no model training in this repo.

> The platform is decision-support only. Clarifyd is not a law firm and does not provide legal advice. The full notice lives on `/terms` (Article 06 — AI limitations).

---

## What it does

1. **Upload** — PDF or DOCX contract, ≤ 25 MB.
2. **Extract** — server-side text extraction (no OCR; text-layer PDFs only for now).
3. **Analyze** — clause taxonomy detection + risk scoring + reasoning model commentary.
4. **Review** — single **Findings** tab shows risky clauses, loopholes, and suggested replacement clauses side-by-side with a one-tap "Apply" toggle.
5. **Export** — verbatim splice of accepted suggestions into the original draft, downloadable as a `print()`-styled PDF. Unchanged sections stay byte-identical.
6. **Audit trail** — every reasoning call, OAuth login, and export is appended to a hash-chained audit log.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI · SQLAlchemy 2.0 async · SQLite (dev) / Postgres·Neon (prod) · Pydantic v2 · `pydantic-settings` |
| Reasoning | **Clarifyd AI** — model + endpoint configurable through `Settings`. Live via **NVIDIA NIM** (OpenAI-compatible): primary `meta/llama-3.1-70b-instruct`, fallback `nvidia/llama-3.3-nemotron-super-49b-v1.5`, `RulesBasedProvider` as always-on floor. Shared **token-bucket rate limiter** (`reasoning_max_rpm`). Provider chain in `services/reasoning/`. |
| Auth | **Clerk (RS256 JWT, JWKS-verified)** is the primary/prod auth. Legacy local email/password (bcrypt + HS256) exists but is **disabled in production**. OAuth 2.0 for Google + Facebook (HMAC-signed state). Per-user `clarifyd.user-key` scopes frontend local storage. |
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript · **Geist Sans + Geist Mono** (via `next/font`) · **Phosphor Icons** (duotone) · Framer Motion · Tailwind 3 (installed; tokens carry the system) · Clerk |
| Aesthetic | **The Broadsheet (v6)** — brutalist editorial. Warm ivory paper (`#f4ede1`), coffee-black ink (`#0c0a08`), single arterial red accent (`#b8260f`). Sharp edges, no gradients, no glass, oversize display type. |
| Storage | SQLite + local FS (dev); Postgres·Neon (prod). A parallel `backend-node/` uses Vercel Blob. |

---

## Repository layout

```text
ai-contract-risk-analyzer/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, middleware, route mount, /analyze
│   │   ├── config.py               # pydantic-settings (env-driven)
│   │   ├── contracts/              # frozen Pydantic API schemas (additive-only)
│   │   ├── routes/
│   │   │   ├── auth.py             # /auth/login /register /me
│   │   │   ├── oauth.py            # /auth/oauth/{google|facebook|microsoft}/{authorize,callback}
│   │   │   ├── reviews.py          # /reviews/queue (per-user scoped)
│   │   │   └── reasoning.py        # /api/v1/reasoning/* (evaluate, guidance, jobs)
│   │   ├── services/
│   │   │   ├── contract_ingestion.py
│   │   │   ├── contract_text_extractor.py
│   │   │   ├── contract_analysis.py
│   │   │   └── reasoning/          # ReasoningProvider ABC + Kimi/OpenAI/Rules + Fallback chain
│   │   ├── db/
│   │   │   ├── base.py · engine.py · session.py
│   │   │   └── models/             # user, oauth_identity, contract_draft, clause_finding, …
│   │   ├── auth/                   # password hashing, JWT, deps
│   │   └── observability/          # Prometheus counters
│   ├── tests/                      # pytest
│   └── .env                        # NEVER COMMITTED — see backend/.env.example
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Landing — "The Broadsheet" (Vol. I)
│   │   ├── login/  login/verify/   # Email/password + Google + Facebook OAuth + OTP
│   │   ├── oauth/callback/         # Receives ?token from backend, persists, redirects
│   │   ├── onboarding/profile/     # Pre-seed lock-in venture + workspace profile
│   │   ├── terms/                  # Terms · Privacy · Cookies (Article 06 = AI limitations)
│   │   ├── dashboard/  findings/   # Founder home + verdict ledger
│   │   ├── copilot/                # Legal Co-Pilot draft room (templates + custom + Q&A)
│   │   ├── negotiation/            # Negotiation lab — master + counter-party drop + finalize
│   │   ├── compare/                # Comparative reading across 2+ drafts
│   │   ├── reasoning/              # Engine deliberation + founder advisor Q&A
│   │   ├── compliance/             # Regulatory desk (GDPR / CCPA / HIPAA / FCPA)
│   │   ├── exports/                # Audit ledger + hash-chain timeline
│   │   ├── monitor/                # Calendar of perils (vesting / IP / renewals)
│   │   ├── lawyer/                 # "Article forthcoming" plate — vetting in progress
│   │   ├── library/  integrations/ # Templates catalog + connector switchboard
│   │   ├── pricing/  faq/  contact/
│   │   └── globals.css             # Broadsheet design tokens + utility classes
│   ├── components/
│   │   ├── broadsheet-search.tsx    # § Index of … editorial search input
│   │   ├── broadsheet-textfield.tsx # Ledger-line text field (drop-in)
│   │   ├── public-shell.tsx         # Masthead + sitemap footer for public pages
│   │   ├── shell/dark-app-shell.tsx # Workspace shell (top nav + tools dropdown + acct popover)
│   │   └── …                        # health-gauge / risk-pill / clause-card / etc.
│   └── lib/
│       ├── user-storage.ts          # Per-user localStorage helper (scopes by clarifyd.user-key)
│       ├── auth.tsx                 # AuthProvider — writes user-key on /auth/me, wipes legacy
│       ├── recent.ts  founder-profile.ts  startup-templates.ts
│       └── api.ts                   # Typed ApiClient
├── docs/slc/                       # Canonical SLC PRD + work-division + assumptions
├── CLAUDE.md                       # Engineering rules (read before non-trivial changes)
└── docker-compose.yml
```

---

## Local development

PowerShell on Windows is the primary shell.

### Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements-dev.txt
Copy-Item ..\backend\.env.example .env   # then fill in keys, see "Environment" below
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```powershell
cd frontend
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # CI gate — must pass before PR
```

### Full stack
```powershell
docker compose up --build
```

### CI validation gate
```powershell
pytest backend\tests -q
npm --prefix frontend run typecheck
```

---

## Environment

`backend/.env` (never committed — see `backend/.env.example` for the template):

### Reasoning
```ini
REASONING_PROVIDER=kimi                                        # provider class name (historical); OpenAI-compatible
REASONING_BASE_URL=https://integrate.api.nvidia.com/v1        # NVIDIA NIM
REASONING_API_KEY=<nvidia nim api key>
REASONING_MODEL=meta/llama-3.1-70b-instruct                  # primary
REASONING_MODEL_FALLBACK=nvidia/llama-3.3-nemotron-super-49b-v1.5
REASONING_TIMEOUT_SECONDS=30
REASONING_MAX_RETRIES=3
REASONING_MAX_RPM=30                                          # token-bucket pace (raise on a paid tier)
```

> The reasoning surface is exposed product-side as **Clarifyd AI**. The provider abstraction lives in
> `app/services/reasoning/`; swap endpoints + models through `Settings` without touching call sites. The
> `KimiProvider` class name is historical — it is just an OpenAI-compatible client; the live models are Llama
> served through NVIDIA NIM. Only the analyze pipeline and the Co-Pilot call the LLM; simplify/negotiate/
> compliance/reasoning-guidance are deterministic.

### OAuth — Google
1. https://console.cloud.google.com/apis/credentials → **Create Credentials** → OAuth client ID → Web application.
2. Authorized JS origin: `http://localhost:3000`
3. Authorized redirect URI: `http://localhost:8000/auth/oauth/google/callback`
4. Paste into `.env`:
   ```ini
   GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...
   ```

### OAuth — Facebook
1. https://developers.facebook.com/apps → **Create app** → use case "Authenticate and request data with Facebook Login" → Consumer.
2. Add product **Facebook Login** → Settings → Valid OAuth Redirect URIs: `http://localhost:8000/auth/oauth/facebook/callback`
3. App settings → Basic → copy App ID + App Secret → paste:
   ```ini
   FACEBOOK_OAUTH_CLIENT_ID=<numeric app id>
   FACEBOOK_OAUTH_CLIENT_SECRET=<32-char hex secret>
   ```
4. While in **Development** mode, only the app owner + listed Test Users can log in. Add testers under **App roles → Roles** before sharing.

### Public URLs
```ini
OAUTH_BACKEND_BASE_URL=http://localhost:8000
OAUTH_FRONTEND_CALLBACK_URL=http://localhost:3000/oauth/callback
```

Restart the backend (`uvicorn` window) after any `.env` change — settings are cached via `@lru_cache get_settings()`.

---

## How OAuth flows end-to-end

```
[user] → /login → "Continue with Google"
       → GET  /auth/oauth/google/authorize     (302 to Google)
       → user consents at Google
       → GET  /auth/oauth/google/callback?code=…&state=…
              ├─ verify HMAC-signed state
              ├─ POST  oauth2.googleapis.com/token  (exchange code → access token)
              ├─ GET   openidconnect.googleapis.com/v1/userinfo
              ├─ upsert  user        (User table)
              ├─ upsert  identity    (OAuthIdentity: provider, subject, name, email, picture, locale, raw_profile_json)
              └─ mint our JWT
       → 302 to  frontend/oauth/callback?token=…&role=…&new=0|1
       → frontend writes  localStorage["clarifyd.token"]
       → window.location.replace("/terms?next=/onboarding/profile")   when new=1
                              or "/dashboard"                          when returning
```

Facebook flow is identical — `auth_url`, `token_url`, `userinfo_url` differ; `_normalize_profile` maps the per-provider payload into a uniform shape before storage.

---

## API surface (selected)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/health` | public | Liveness probe |
| POST | `/auth/register` | public | Email+password signup |
| POST | `/auth/login` | public | Email+password login |
| GET  | `/auth/me` | bearer | Current user + linked OAuth identities |
| GET  | `/auth/oauth/{provider}/authorize` | public | Redirect to Google / Facebook consent |
| GET  | `/auth/oauth/{provider}/callback` | provider | Exchange code, mint JWT, redirect to frontend |
| POST | `/analyze/contract` | reviewer | Upload PDF/DOCX → run pipeline → findings (rate-limited + concurrency slot) |
| POST | `/analyze/text` | reviewer | Same pipeline on pasted text (40–400k chars) |
| POST | `/analyze/url` | reviewer | Fetch URL (SSRF-guarded) → analyze |
| POST | `/api/v1/copilot/guidance` (+`/stream`) | viewer | Clarifyd AI co-pilot (LLM; SSE stream variant) |
| GET  | `/reviews` | reviewer | This user's pending review queue |
| POST | `/api/v1/reasoning/evaluate` | bearer | Re-run reasoning over a draft / raw text |
| POST | `/api/v1/reasoning/guidance` | bearer | Follow-up founder-guidance question |
| GET  | `/api/v1/reasoning/categories` | public | Supported clause taxonomy |

Full OpenAPI: `http://localhost:8000/openapi.json` · interactive docs: `http://localhost:8000/docs`.

Every reasoning response carries the mandatory disclaimer (`not_legal_advice: true` + canonical string — see PRD §4.12 / A3).

---

## Frontend conventions

- **Design system — The Broadsheet (v6).** Brutalist editorial. Tokens defined in `app/globals.css` under `--bsd-*`:
  - Surface — `--bsd-paper #f4ede1` · `--bsd-paper-deep #ebe2d0`
  - Ink — `--bsd-ink #0c0a08` · `--bsd-body #2b251f` · `--bsd-muted #6c6356`
  - Accent — `--bsd-red #b8260f` (single accent, used sparingly)
  - Rules — `--bsd-hairline 10%` · `--bsd-rule 20%` · masthead `3px double` ink
  - Sharp edges (no `border-radius`), no gradients, no glass, no shadows.
- **Type.** Geist Sans (display + body) + Geist Mono (kickers, captions, ledger numbers). Loaded via `next/font`.
- **Icons.** Phosphor Icons (duotone weight).
- **Motion.** Framer Motion 11. All entries `cubic-bezier(0.23, 1, 0.32, 1)` (ease-out-quart), 220–360ms, transform + opacity only. Hover gated `@media (hover: hover) and (pointer: fine)`. `prefers-reduced-motion` strips transforms via global override.
- **Per-user state.** Local data is scoped through `lib/user-storage.ts` — every read/write suffixes the key with `clarifyd.user-key` (written by `AuthProvider` from `/auth/me.email`). On login or logout the helper wipes the 11 known legacy unscoped keys so a fresh account never sees prior-user data.
- **Form chrome killed.** `.bsd-input` (transparent + 2px ink underline, 3px red on focus), `.bsd-range` (custom slider with red thumb + ring), `.bsd-search-input` (search-decoration suppressed), `<select>` styled inline. No browser blue rings anywhere.

---

## Engineering rules

Read `CLAUDE.md` before non-trivial changes. The short version:

- **Backend-first is locked.** Frontend implementation work only after the Week-2 backend readiness checkpoint.
- **`contracts/api.py` is frozen at T1.** Changes are additive-only and require Group Mate B sign-off.
- **Layer separation is strict.** `routes/` → `services/` → `models/` → `db/`. Services contain no FastAPI imports.
- **Errors:** raise `AppError` with an `ErrorCode`. Never raise bare `HTTPException` — the envelope `{error: {code, message, details, request_id}}` is contract.
- **Confidence thresholds** come from `docs/slc/SLC_ASSUMPTIONS_AND_DECISIONS.md`. Do not invent thresholds in code.
- **`db_create_all_on_startup=True`** in dev. New tables are auto-created. Column additions on **existing** tables need a manual migration (SQLite-friendly `ALTER TABLE` or drop + recreate that table).
- **Reasoning cache key:** `(provider, model, sha256(clause_text))`. Do not add a second cache.
- **Audit:** every reasoning call + OAuth login + export emits `append_audit_event(...)`.

---

## What's *not* implemented yet

- OCR for scanned-image PDFs (text-layer only today)
- Redis / Elasticsearch / S3 — not used by the live FastAPI backend (Postgres·Neon **is** the prod DB; the parallel `backend-node/` uses Vercel Blob + Upstash)
- Multi-tenant org model (single-user records, no orgs yet)
- WebSocket live updates for the review queue (poll-based for now)
- Microsoft OAuth (config kept, not wired)
- OTP email verification (endpoints dormant; register auto-verifies)

**Recently landed:** shared token-bucket LLM rate limiter (`reasoning_max_rpm`), `force_majeure` + `entire_agreement` clause categories, tightened clause lexicon (fixed long-contract boilerplate over-match), merit-based severity rubric (v4) with escalation triggers, NVIDIA-NIM Llama models replacing retired Kimi K2.

---

## License & disclaimer

This is a student / SLC delivery project. The reasoning output is **not legal advice** under any jurisdiction. Founders must consult licensed counsel before acting on suggestions surfaced by the tool.

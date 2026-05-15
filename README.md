# Clarifyd — AI Startup Legal Assistant

> AI-assisted contract risk review for early-stage founders. Upload a PDF / DOCX, get clause-level risk findings, founder-friendly guidance, and an exportable redlined draft — without paying for an hour of legal counsel before you know the questions to ask.

**Status:** SLC (Simple, Loveable, Complete) — Week 2 backend + reskinned frontend integrated. Reasoning runs against an external provider (Kimi via NVIDIA NIM). No model training in this repo.

> ⚠️ Decision-support tool only. Not legal advice. Every reasoning response is tagged `not_legal_advice: true` and recommends licensed counsel for jurisdiction-specific opinions.

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
| Backend | FastAPI · SQLAlchemy async · SQLite (`clarifyd.db`) · Pydantic v2 · `pydantic-settings` |
| Reasoning | NVIDIA NIM endpoint (`integrate.api.nvidia.com/v1`), `meta/llama-3.3-70b-instruct` (Kimi K2.6 swappable via env), with a `RulesBasedProvider` fallback chain |
| Auth | Local email/password (bcrypt + JWT HS256) **and** OAuth 2.0 for Google + Facebook (HMAC-signed state, JWT issued by us) |
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind via CDN · Plus Jakarta Sans + Fraunces + JetBrains Mono |
| Storage | Local filesystem + SQLite for dev. S3/Postgres are scaffolded in config but not active. |

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
│   └── app/
│       ├── login/                  # Email/password + Google + Facebook OAuth buttons
│       ├── oauth/callback/         # Receives ?token from backend, persists, redirects
│       ├── onboarding/             # Identity → Venture → Workspace 3-step flow
│       ├── terms/                  # Terms + Privacy + Cookies acceptance (gates new users)
│       ├── dashboard/              # Founder-profile-aware home
│       ├── findings/               # Unified risky-clauses / loopholes / suggestions tab
│       ├── copilot/                # Smart Builder — clause-by-clause draft generation
│       ├── negotiation-lab/        # Command-center view for live deals
│       ├── pricing/  terms/  founder/
│       └── globals.css             # Crystal-glass, aurora, bubbly-easing primitives
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
REASONING_PROVIDER=kimi
REASONING_BASE_URL=https://integrate.api.nvidia.com/v1
REASONING_API_KEY=<nvapi-…>
REASONING_MODEL=meta/llama-3.3-70b-instruct
REASONING_MODEL_FALLBACK=meta/llama-3.3-70b-instruct
REASONING_TIMEOUT_SECONDS=60
REASONING_MAX_RETRIES=1
```

> Get a NIM key: https://build.nvidia.com/ → sign in → API Catalog → any Llama / Kimi model → **Get API Key**.

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
| POST | `/analyze` | bearer | Upload contract, run analysis, return findings |
| GET  | `/reviews/queue` | bearer | This user's pending drafts |
| POST | `/api/v1/reasoning/evaluate` | bearer | Re-run reasoning over a draft / raw text |
| POST | `/api/v1/reasoning/guidance` | bearer | Follow-up founder-guidance question |
| GET  | `/api/v1/reasoning/categories` | public | Supported clause taxonomy |

Full OpenAPI: `http://localhost:8000/openapi.json` · interactive docs: `http://localhost:8000/docs`.

Every reasoning response carries the mandatory disclaimer (`not_legal_advice: true` + canonical string — see PRD §4.12 / A3).

---

## Frontend conventions

- **Design system:** crystal-glass panels (`bg: rgba(255,255,255,0.35–0.55)` + `backdrop-filter: blur(20–25px) saturate(140–160%)`), aurora-blob background, bubbly easing `cubic-bezier(0.34, 1.56, 0.64, 1)`. Defined in `app/globals.css`.
- **Motion:** all animations respect `prefers-reduced-motion`. Scroll reveals use `translate3d + opacity` (never `filter: blur()` — it's GPU-hostile against the backdrop-filter glass).
- **State:** local-only for now. Keys live under the `clarifyd.*` namespace in `localStorage`:
  `clarifyd.token`, `clarifyd.role`, `clarifyd.analyses`, `clarifyd.recent-drafts`, `clarifyd.founder-profile`, `clarifyd.onboarded`, `clarifyd.cookie-consent`, `clarifyd.terms-accepted`, `clarifyd.last-analysis`.
- **Forms:** Tailwind forms plugin sets a grey border on every `[type='text']` and `<select>`. The `.glass-field` class in `globals.css` overrides this with `!important` to nuke `border` / `outline` / `box-shadow` / `--tw-ring-shadow`.

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
- Postgres / S3 / Redis / Elasticsearch — config slots exist, code paths use SQLite + local FS
- Multi-tenant org model (single-user records, no orgs yet)
- WebSocket live updates for the review queue (poll-based for now)
- Microsoft OAuth UI button (backend route still works for backward compat)
- Production-grade rate limiting (in-memory limiter only — replace with Redis sliding window for prod)

---

## License & disclaimer

This is a student / SLC delivery project. The reasoning output is **not legal advice** under any jurisdiction. Founders must consult licensed counsel before acting on suggestions surfaced by the tool.

# Clarifyd — Architecture

> **Status:** describes the system **as actually built** (code-derived, 2026-07). Supersedes all earlier
> aspirational/PRD architecture. Where an older doc claims Kubernetes, microservices, Elasticsearch, Celery,
> Redis, S3, multi-region AWS, MFA/SAML, or a "three-pass GPT-4o" pipeline — those were never built. This
> document is the source of truth.

## Table of Contents
1. [System Overview](#system-overview)
2. [High-Level Topology](#high-level-topology)
3. [The Three Apps](#the-three-apps)
4. [Backend (FastAPI) — the live API](#backend-fastapi--the-live-api)
5. [Analysis Pipeline](#analysis-pipeline)
6. [Reasoning Provider Chain](#reasoning-provider-chain)
7. [Data Layer](#data-layer)
8. [Frontend (Next.js 14)](#frontend-nextjs-14)
9. [Node Backend (parallel track)](#node-backend-parallel-track)
10. [Security](#security)
11. [Observability & Audit](#observability--audit)
12. [Deployment](#deployment)
13. [Testing](#testing)
14. [Key Decisions](#key-decisions)

---

## System Overview

Clarifyd (AI Contract Risk Analyzer) is a single-workflow SaaS for **pre-seed founders**:

> **upload → analyze → review → export**

A user uploads a contract (PDF/DOCX/paste/URL). The backend extracts clauses with a deterministic
rules engine, scores each clause's risk with an LLM (severity + 1–10 score + plain-English rationale),
runs whole-contract sweeps for loopholes and ambiguity, and returns a health score with per-clause findings.
Findings can be reviewed in a queue and exported (JSON/PDF) with a tamper-evident audit trail.

It is **not** a microservice mesh. It is a **FastAPI monolith** + a **Next.js 14 frontend**, plus a
**parallel Next.js 16 backend** kept on a separate deployment track.

Reasoning is exposed product-side as **Clarifyd AI** — a swappable provider abstraction. The live model is
served through **NVIDIA NIM** (OpenAI-compatible). No model is trained in this repo.

---

## High-Level Topology

```
                    ┌───────────────────────────────────────┐
   Browser  ───────▶│  Frontend — Next.js 14 (App Router)   │  Clerk auth (JWT)
                    │  "Broadsheet v6" brutalist UI          │  port 3000
                    └───────────────────┬───────────────────┘
                       /api/:path*  rewrite (next.config.js, 300s proxy)
                                        │  Authorization: Bearer <Clerk JWT>
                                        ▼
                    ┌───────────────────────────────────────┐
                    │  Backend — FastAPI monolith           │  port 8000
                    │  request-id + timing + security hdrs  │  GET /health
                    │                                        │
                    │  ingest → extract → analyze pipeline   │
                    │  reasoning provider chain              │──▶ NVIDIA NIM
                    │  reviews · exports · audit chain       │    (OpenAI-compatible
                    └───────────────────┬───────────────────┘     chat completions)
                                        │  async SQLAlchemy 2.0
                                        ▼
                    ┌───────────────────────────────────────┐
                    │  SQLite (dev)  /  Postgres·Neon (prod) │
                    │  drafts · findings · queue · audit ·   │
                    │  clause_cache · report_cache · users   │
                    └───────────────────────────────────────┘

   Parallel/secondary track (not wired to the Clerk frontend):
   backend-node — Next.js 16 + Drizzle + NextAuth + Inngest + Vercel Blob, deployed to Vercel,
   whose live footprint is 5 Vercel Cron jobs (deadlines, regulation diff, retention, playbook, digest).
```

---

## The Three Apps

| App | Stack | Role | Auth | Deploy |
|---|---|---|---|---|
| `frontend/` | Next.js 14, React 18, TS, Clerk | The UI | Clerk (client-side gating) | DigitalOcean / Docker, port 3000 |
| `backend/` | FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2 | **The live API** | Clerk RS256 (+ legacy HS256, prod-disabled) | DigitalOcean / Docker, port 8000 |
| `backend-node/` | Next.js 16, Drizzle, NextAuth, Inngest | Parallel Vercel rewrite | NextAuth (Auth.js v5) | Vercel, port 3001 |

**The live product = `frontend/` (Clerk) + `backend/` (FastAPI).** They share auth (Clerk/JWT) and are both
in `docker-compose.yml`, `.github/workflows/ci.yml`, and `.do/*.yaml`. `backend-node/` uses NextAuth (a
different auth model) and a separate Neon DB — it is a parallel track, not what the frontend calls. No file in
the repo binds the `clarifyd.app` domain; production wiring lives in the hosting dashboards.

---

## Backend (FastAPI) — the live API

Entry: `app/main.py` (ASGI `app`); `api/index.py` is a Vercel serverless shim importing `app.main:app`.
Because Vercel does not fire `lifespan`, services and the DB engine are (re)built per event loop in
`_ensure_runtime` (`main.py`).

**Roles:** `viewer (0) < reviewer (1) < admin (2)`, enforced by `require_role(...)`.

### Core endpoints (defined in `main.py`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | public | status + reasoning provider |
| GET | `/metrics` | public | Prometheus exposition |
| POST | `/analyze/contract` | reviewer | upload PDF/DOCX → full pipeline (rate-limited + concurrency slot) |
| POST | `/analyze/text` | reviewer | same pipeline on pasted text (40–400k chars) |
| POST | `/analyze/url` | reviewer | fetch URL (SSRF-guarded: no redirects, ports 80/443) → analyze |
| POST | `/api/v1/copilot/guidance` (+`/stream`) | viewer | Clarifyd AI legal co-pilot (LLM; SSE stream variant) |
| DELETE | `/auth/account` | authenticated | right-to-erasure: purge drafts/findings/queue + delete from Clerk |

### Feature routers (`app/routes/`)
- **auth** (`/auth`) — password login/register (HS256; **OTP gate commented out, auto-verifies**), `/auth/me`. All POSTs rate-limited + legacy-auth blocked in prod.
- **oauth** (`/auth/oauth`) — Google + Facebook code flow, HMAC-signed state → upserts `oauth_identity`+`user`.
- **reviews** (`/reviews`, reviewer) — list queue, claim, decide (accept/request_change/escalate → `review_action`).
- **analyses** (`/api/v1/analyses`, reviewer) — list stored, mark negotiated, regenerate report.
- **reasoning** (`/api/v1/reasoning`) — PRD §4.12 surface. `/categories` (public), `/evaluate` (viewer; ranks stored findings — **founder guidance is a deterministic scaffold, not an LLM call**), `/guidance` (viewer; templated, refuses jurisdiction-specific questions), `/jobs/{id}` (in-memory).
- **exports** (`/exports`) — create (reviewer), status + download (viewer), ownership-checked.
- **admin** — soft-delete own draft, `/audit/verify` (admin), `/admin/users|stats`, delete user (also from Clerk).
- **compliance** (`/api/v1/compliance`, viewer) — rules table (GDPR/CCPA/HIPAA/FCPA) matched to findings. Non-LLM.
- **simplify / negotiate / compare / search / comments / workflow / webhooks / contact / feedback** — feature surfaces; **simplify, negotiate, compliance are deterministic (no LLM)**.

**Only the analyze pipeline (clause scoring, reporter, sweeps, detector) and the Co-Pilot call the live LLM.**

### Service layer (`app/services/`)
`contract_ingestion` (filename/MIME magic-byte/size/sha256) · `contract_text_extractor` (pypdf, DOCX-xml, txt) ·
`contract_analysis` (rules-based clause extraction) · `async_contract_analysis` (async per-clause LLM scoring,
cache, injection flag) · `custom_reasoning_model` (deterministic rules engine + OpenAI-shaped envelope) ·
`contract_detector` (is-this-a-contract gate) · `contract_reporter` (whole-contract report, cached, grounded) ·
`loophole_sweep` / `ambiguity_sweep` (one LLM call each over full text) · `copilot_advisor` (co-pilot chat) ·
`audit` (hash chain) · `export` (JSON/PDF) · `email` (console dev / Resend prod).

---

## Analysis Pipeline

`_analyze_and_persist` (`main.py`) orchestrates every upload:

```
INPUT (file / text / url)
  │
  ├─ ContractDetector gate ── not a contract → 422 not_a_contract
  │     (heuristic stems vs negatives, then LLM; fails-open w/o key, fails-closed on LLM error)
  ▼
  ├─ kick off IN PARALLEL over full text:
  │     • ContractReporter   (verdict / summary / loopholes / suggestions / cross-verification)
  │     • LoopholeSweeper     (material + MISSING clauses → synthetic findings)
  │     • AmbiguitySweeper    (vague/undefined language)
  │
  ├─ ContractAnalysisService.extract_clauses   (RULES-BASED, no LLM)
  │     sentence split → heading fusion → same-category merge → keyword classify
  │     categories incl. force_majeure + entire_agreement; force-majeure guard;
  │     tightened assignment/dispute lexicon (no boilerplate over-match)
  │
  ├─ AsyncContractAnalysisService.analyze      (PER-CLAUSE LLM, Semaphore(8) + rate limiter)
  │     each clause → provider chain → {severity, risk_score 1-10, confidence, rationale}
  │     ClauseCache lookup/write keyed (provider, model, sha256, prompt_version=v4-merit-based)
  │     prompt-injection flag per clause
  │
  ├─ merge + dedupe sweep findings into per-clause findings
  ├─ severity filter: drop `low` with score ≤ 2
  ├─ persist ContractDraft + ClauseFinding; auto-route high/critical to review queue
  ├─ keep/cancel reporter based on presence of high/critical
  └─ persist analysis_json
OUTPUT: health score + findings   (internal 1-10 scores ×10 → 1-100 for the API)
```

**Measured (llama-3.1-70b via NVIDIA NIM, 2026-07):** ~89% exact severity vs ground truth, 100% within one band,
100% precision on benign contracts (no false alarms), ~6–7s/clause. The rules extractor fixed a boilerplate
over-match bug that previously mislabeled ~87% of clauses on long (20-page) contracts.

---

## Reasoning Provider Chain

`app/services/reasoning/`. Swappable, OpenAI-compatible, with graceful fallback.

```
FallbackChainProvider
  ├─ KimiProvider(reasoning_model)            ← primary   (OpenAIProvider subclass)
  ├─ KimiProvider(reasoning_model_fallback)   ← optional  (skipped if == primary)
  └─ RulesBasedProvider                        ← always-on deterministic floor
```

- **`provider.py`** — `ReasoningProvider` ABC; `ClauseAssessment {severity, risk_score 1-10, confidence, rationale}`.
- **`openai_provider.py`** — Chat Completions, `response_format=json_object`, temp 0, max_tokens 1200; tenacity retry on `{408,409,425,429,5xx}` with exponential backoff; optional **rate limiter**.
- **`kimi_provider.py`** — `OpenAIProvider` subclass (only the name/base-URL differ; NVIDIA NIM is OpenAI-compatible).
- **`rules_provider.py`** — deterministic fallback via `CustomReasoningModel`.
- **`rate_limiter.py`** — shared **token-bucket** `AsyncRateLimiter(reasoning_max_rpm)`; paces all concurrent clause calls so `gather()` bursts don't trip provider 429s. One instance shared across primary + fallback.
- **`prompts.py`** — clause-assessment prompt: severity rubric + **escalation triggers** (uncapped/nominal liability, personal guarantee, perpetual/unrelated IP, unilateral rights, waivers) + **de-escalation guard** (curable-with-notice = medium) + calibration examples. Version `v4-2026-07-09-merit-based`.
- **`injection.py`** — regex prompt-injection detection; clause text is treated as untrusted data.

**Live model config** is driven entirely by env (`REASONING_MODEL`, `REASONING_MODEL_FALLBACK`, `REASONING_BASE_URL`,
`REASONING_API_KEY`, `REASONING_MAX_RPM`). Current: primary `meta/llama-3.1-70b-instruct`, fallback
`nvidia/llama-3.3-nemotron-super-49b-v1.5`, base `https://integrate.api.nvidia.com/v1`.

> **Note:** the config validator currently pins `reasoning_provider == "kimi"` (the class name is historical —
> `KimiProvider` is just "an OpenAI-compatible endpoint"). The Kimi K2 model itself was retired from the NVIDIA
> account; the provider class is reused unchanged for the Llama models.

---

## Data Layer

**Async SQLAlchemy 2.0.** SQLite in dev; Postgres/Neon in prod (`postgresql+asyncpg`, `NullPool`,
`statement_cache_size=0`, per-request engine on serverless). Tables created via `Base.metadata.create_all` on
startup (Alembic migrations exist — `0001_baseline`, `0002_user`, `0003_clause_cache`, `report_cache` — but
runtime relies on `create_all`).

**Tables** (`app/db/models/`): `user` · `contract_draft` (+`analysis_json`, `negotiated_at`) ·
`clause_finding` (severity, score, confidence, excerpt, safer_language, injection_suspected) ·
`review_queue_item` · `review_action` · `audit_event` (sha256 hash-chain, genesis `0`×64) ·
**`clause_cache`** (PK provider+model+clause_sha256) · **`report_cache`** (PK provider+model+prompt_version+contract_sha256) ·
`export_job` · `comment` · `feedback` · `contact_message` · `email_verification` (bcrypt OTP, dormant) ·
`oauth_identity` · `webhook`.

Two caches are the performance core: **`clause_cache`** (identical clauses scored once) and **`report_cache`**
(whole-contract reports). Both keyed by content sha256 + prompt version, so a prompt change auto-invalidates.

---

## Frontend (Next.js 14)

`frontend/` — App Router, React 18, TypeScript, Clerk, Radix, Framer Motion, Phosphor duotone icons, Geist fonts.

- **Workflow screens:** `/dashboard` (intake — upload/paste/URL, auto-classify, context), `/findings` (review — clause cards, health gauge, risk pills), `/negotiation` (counter-offers), `/exports` (audit ledger, hash-chain, PDF via jsPDF). `/` is the "Broadsheet" brutalist marketing landing. `/copilot` is Clarifyd AI chat.
- **API client:** single `lib/api.ts` `ApiClient` — the whole backend surface, with base-URL resolution, retry/backoff, dead-host guarding, bearer-token injection. Talks to backend via `next.config.js` rewrite `/api/:path* → ${BACKEND_ORIGIN}` (300s proxy timeout for slow LLM calls).
- **Auth:** Clerk. `AuthProvider` mints a fresh Clerk JWT per request (rotated ~60s, refreshed every 30s). Gating is **client-side** in `DarkAppShell`; `middleware.ts` runs `clerkMiddleware` for session context only (no edge protection).
- **Analysis runner:** `lib/analysis-context.tsx` runs the fetch above the route outlet so an in-flight analysis survives navigation (fixed progress pill), then routes to `/findings?draft=<id>`.
- **State:** React Context only (no Redux/Zustand). Per-user localStorage scoping via `lib/user-storage.ts` (keys suffixed with signed-in email; legacy keys wiped on user switch). Server fallback via `GET /api/v1/analyses` when local cache is empty.
- **Design system — "Broadsheet v6":** tokens in `app/globals.css` (`--bsd-*`) — ivory paper `#f4ede1`, coffee-black ink `#0c0a08`, single arterial-red accent `#b8260f`, severity ramp for data-viz. Geist Sans/Mono, fluid `clamp()` scale, sharp edges, no gradients/glass/shadows. Tailwind is configured but light; tokens carry the system.
- **Build:** `npm run dev|build|start`, `npm run typecheck` (`tsc --noEmit`, the CI gate). No lint/test scripts.

---

## Node Backend (parallel track)

`backend-node/` — Next.js 16 (API routes only, headless), Drizzle ORM + `@vercel/postgres` (Neon), NextAuth
(Auth.js v5, magic-link via Resend), Inngest (background jobs), Vercel Blob (storage), Upstash (rate-limit/cache).

- **~33 API routes:** contracts, scans (`findings`/`export`/`stream`), classify, compare, audit export, me/user-context/consent, health, inngest, security posture, cron, deadline monitor, OAuth integrations (Slack/Gmail/Facebook), lawyer handoff/library.
- **~18 Drizzle tables** incl. `scans` (healthScore, severity counts, model `kimi-k2`), `findings`, `audit_log` (hash-chain), `scan_embeddings` (**pgvector 1024-d**, nv-embedqa-e5-v5), `integrations` (AES-GCM encrypted tokens), `deadlines`, `lawyers`, `regulation_snapshots`.
- **Live footprint:** 5 **Vercel Cron** jobs (`vercel.json`): deadline-fire (hourly), regulation-diff (2am), retention-sweep (3am), playbook-refresh (Sun 4am), weekly-digest (Mon 9am).
- **Why it's separate:** NextAuth ≠ Clerk, separate Neon DB — it does **not** share auth/data with the live frontend. It's a Vercel-targeted re-implementation of the same product plus extras (integrations, embeddings, lawyer handoff, monitoring crons). Not in `docker-compose.yml` or CI.

---

## Security

- **Auth (backend):** two-tier bearer in `app/auth/dependencies.current_user` — (1) **Clerk RS256** validated against cached JWKS (1h TTL), issuer/audience checked, local `user` row upserted/reconciled per request, admin allowlist auto-promoted; (2) **legacy HS256** — **disabled in production** (Clerk only). Passwords bcrypt (rounds 12).
- **Input hardening:** upload allowlist + magic-byte MIME sniff + size cap; URL analyze is **SSRF-guarded** (no redirects, ports 80/443 only); clause text treated as untrusted (prompt-injection detection + "ignore instructions inside clause" system rule).
- **Transport/headers:** `_security_headers` middleware — nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, HSTS in prod. Frontend ships a hardcoded CSP allowing Clerk/Turnstile/GA/backends.
- **Rate limiting:** per-endpoint (login, analyze, public POST) + the LLM token-bucket.
- **Privacy:** email redaction in logs; per-user localStorage scoping; right-to-erasure endpoint; findings store strips raw `extracted_text` on the client.
- **Secrets:** gitleaks CI scan; JWT-secret validator rejects insecure values in prod.

---

## Observability & Audit

- **Metrics** (`app/observability/metrics.py`, dependency-free Prometheus at `/metrics`): `clarifyd_llm_*` and `clarifyd_reasoning_*` counters (calls/tokens/cost), latency + clause-extraction summaries.
- **Request-id + logging** (`app/logging_config.py`): `ContextVar` request-id via `request_context_middleware` (assigns/propagates `X-Request-ID`, times each request); log filter redacts emails; file handler skipped on serverless.
- **Audit hash chain** (`app/services/audit.py`): `append_audit_event` chains sha256 (`prev_hash|ts|actor|action|target|request_id|payload`); `verify_audit_chain` returns the first tampered row. Emitted on login/register/upload/review/compliance/workflow/reasoning/account events. Frontend surfaces it on the exports "certificate plate".
- **Error envelope** (`app/errors.py`): `AppError(code, message, status, details)` → `{"error": {code, message, details, request_id}}`. Codes: `policy_violation, request_validation_error, upload_rejected, not_a_contract, off_topic_question, internal_error`. 422 for validation, 500 generic (no internals leaked).

---

## Deployment

- **Docker Compose** (`docker-compose.yml`): `backend` (python:3.11-slim, uvicorn, 8000, health `/health`) + `frontend` (node:20-alpine, 3000, `depends_on: backend`). `backend-node` is not in compose.
- **DigitalOcean App Platform** (`.do/backend.yaml`, `.do/frontend.yaml`): FastAPI `api` service + Next 14 `web` service, Neon `DATABASE_URL`, NVIDIA NIM + Clerk secrets, `deploy_on_push: true`, region `nyc`.
- **Vercel:** `backend-node/` deploys standalone (`clarifyd-backend.vercel.app` per its `DEPLOY.md`) with 5 cron jobs; `.vercel/` references two projects.
- **CI** (`.github/workflows/ci.yml`): `backend` (pytest, py3.11) + `frontend` (typecheck + build, node 20) + `secret-scan` (gitleaks). `backend-node` is **not** in CI.
- **Env:** `backend/.env.example` (DATABASE_URL, JWT_SECRET, REASONING_*, Clerk, OAuth); `frontend/.env.example` (Clerk + NEXT_PUBLIC_API_URL); `backend-node/.env.example` (Neon, Blob, NIM, Auth.js, Resend, Upstash, Inngest, OAuth).

> The `clarifyd.app` domain is not bound in the repo. The coherent live stack (compose + CI + DO specs) is
> **Next 14 frontend + FastAPI backend**; confirm exact production wiring in the DO/Vercel dashboards.

---

## Testing

- **Backend** (`backend/tests/`): 18 unit files (analyze, auth, ingestion, extractor, reasoning provider/API, reporter guardrails, reviews, security/audit, upload security, db models, …) + `tests/benchmarks/test_kimi_quality.py` (marked `benchmark`, excluded by default via `pytest.ini addopts=-m "not benchmark"`). `conftest.py` boots the app on a temp SQLite DB with seeded viewer/reviewer/admin.
- **Frontend:** `npm run typecheck` is the CI gate; no unit tests.
- **Ad-hoc:** repo-root `_bench_*.py` scripts (accuracy/ensemble/cold-latency) — not part of the pytest suite.

---

## Key Decisions

- **Monolith, not microservices.** One FastAPI app, strict internal layering (`main` → `routes` → `services` → `db`). No K8s/Celery/Redis/Elasticsearch — those never existed.
- **Rules extraction + LLM scoring.** Clause *segmentation/labeling* is deterministic keyword rules (fast, free, testable); only *risk judgment* uses the LLM. This isolates the expensive/non-deterministic step to one place and is why long-contract labeling could be fixed without touching the model.
- **Provider abstraction + fallback chain.** Swapping the LLM is config-only; a rules-based provider is the always-on floor so the app degrades instead of failing.
- **Token-bucket rate limiter.** The real production bottleneck is provider RPM limits, not CPU. Pacing + retry means throttling slows analysis instead of dropping findings.
- **Content-hash caches + hash-chained audit.** `clause_cache`/`report_cache` make re-analysis cheap and prompt-version-safe; the audit chain makes the export trail tamper-evident.
- **Two backends, deliberately.** `backend/` (FastAPI, live) is the original; `backend-node/` (Vercel/Drizzle) is a parallel path — confirm the target before editing shared logic.
```

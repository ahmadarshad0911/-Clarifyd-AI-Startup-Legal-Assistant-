# Project Structure

> **As-built** (code-derived, 2026-07). Reflects the real repository. For the full system design see
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Clarifyd is a monorepo with **three apps** plus infra and docs.

```
ai-contract-risk-analyzer/
├── backend/            FastAPI monolith — THE LIVE API (Python)
├── backend-node/       Next.js 16 + Drizzle — parallel Vercel track (secondary)
├── frontend/           Next.js 14 + Clerk — the UI
├── docs/               architecture, viva, SLC planning docs
├── .do/                DigitalOcean App Platform specs (backend.yaml, frontend.yaml)
├── .github/workflows/  CI (ci.yml: backend pytest · frontend typecheck+build · gitleaks)
├── .vercel/            Vercel project links
├── docker-compose.yml  backend (8000) + frontend (3000)
└── *.md                README, PROGRESS, CONTRIBUTING, design, this file
```

## backend/ — FastAPI (live API)

```
backend/
├── app/
│   ├── main.py                 ASGI app, middleware (request-id, timing, security headers),
│   │                           exception handlers, core /analyze/* + /copilot + /health routes,
│   │                           _build_provider_chain(), _ensure_runtime() (per-loop init)
│   ├── config.py               Settings (pydantic-settings), get_settings() lru_cache,
│   │                           all REASONING_*, Clerk (issuer, JWKS, secret key,
│   │                           CLERK_WEBHOOK_SECRET), JWT, OAuth, rate-limit, retention config
│   ├── errors.py               AppError + ErrorCode; {"error":{code,message,details,request_id}}
│   ├── logging_config.py       request-id ContextVar, email-redacting log filter
│   ├── rate_limit.py           per-endpoint limiters (login / analyze / public-post)
│   ├── auth/                   Clerk RS256 (JWKS) + legacy HS256 (prod-disabled), require_role,
│   │                           bcrypt passwords, token mint/decode
│   ├── contracts/              FROZEN Pydantic schemas — api.py (request/response),
│   │                           analysis.py (ClauseType, RiskSeverity, ExtractedClause, …),
│   │                           ingestion.py  (NOT HTTP routers — schemas only)
│   ├── routes/                 feature routers: auth, oauth, reviews, analyses, reasoning,
│   │                           exports, admin, compliance, simplify, negotiate, compare, search,
│   │                           comments, workflow, webhooks, contact, feedback, letterhead,
│   │                           clerk_webhooks (POST /webhooks/clerk — Svix-verified user.deleted)
│   ├── services/               business logic (no FastAPI imports):
│   │   ├── contract_ingestion.py        upload validation (MIME magic-byte, size, sha256)
│   │   ├── contract_text_extractor.py   PDF/DOCX/TXT → text
│   │   ├── contract_analysis.py         RULES-BASED clause extraction (sync)
│   │   ├── async_contract_analysis.py   async per-clause LLM scoring + cache + injection flag
│   │   ├── custom_reasoning_model.py    deterministic rules engine + OpenAI-shaped envelope
│   │   ├── contract_detector.py         is-this-a-contract gate
│   │   ├── contract_reporter.py         whole-contract LLM report (cached, grounded)
│   │   ├── loophole_sweep.py            missing/material loopholes (1 LLM call)
│   │   ├── ambiguity_sweep.py           vague/undefined language (1 LLM call)
│   │   ├── copilot_advisor.py           Clarifyd AI co-pilot chat + streaming; READY_TO_DRAFT
│   │   │                                readiness protocol gates the Generate button
│   │   ├── user_purge.py                purge_user_data() — every row a deleted account owns
│   │   │                                (audit_event deliberately retained: hash chain)
│   │   ├── audit.py                     sha256 hash-chained audit events + verify
│   │   ├── export.py                    JSON/PDF export jobs (reportlab)
│   │   ├── email.py                     Console (dev) / Resend (prod)
│   │   └── reasoning/                   PROVIDER CHAIN:
│   │       ├── provider.py              ReasoningProvider ABC, ClauseAssessment
│   │       ├── openai_provider.py       Chat Completions, json_object, tenacity retry, rate-limit
│   │       ├── kimi_provider.py         OpenAIProvider subclass (NVIDIA NIM base URL)
│   │       ├── rules_provider.py        deterministic fallback
│   │       ├── chain.py                 FallbackChainProvider
│   │       ├── prompts.py               clause rubric + escalation triggers (v4-merit-based)
│   │       ├── rate_limiter.py          AsyncRateLimiter (token bucket, reasoning_max_rpm)
│   │       └── injection.py             prompt-injection detection
│   ├── db/                      async SQLAlchemy 2.0 — models/ (user, contract_draft,
│   │                           clause_finding, review_queue_item, review_action, audit_event,
│   │                           clause_cache, report_cache, export_job, comment, feedback,
│   │                           contact_message, email_verification, oauth_identity, webhook),
│   │                           session.py (serverless-safe engine)
│   └── observability/          metrics.py (Prometheus /metrics), audit helpers
├── alembic/                    4 migrations (runtime uses create_all)
├── tests/                      unit/ (18 files) + benchmarks/ (test_kimi_quality.py)
├── api/index.py                Vercel serverless shim → app.main:app
├── Dockerfile                  python:3.11-slim, uvicorn
├── requirements*.txt · pytest.ini · alembic.ini
└── _bench_*.py                 ad-hoc accuracy/latency scripts (not in pytest suite)
```

## frontend/ — Next.js 14 (UI)

```
frontend/
├── app/                page.tsx (Broadsheet landing), dashboard/ (intake), findings/ (review),
│                       negotiation/, exports/ (audit ledger), copilot/, login/, onboarding/,
│                       oauth/callback, + ~25 secondary pages. No app/api/ (proxied to backend).
├── components/         ~48 files: shell/ (DarkAppShell, side-nav, audit-chain-badge),
│                       findings/, upload/, exports/, clause-card, health-gauge, risk-pill, …
├── lib/                api.ts (ApiClient — full backend surface), auth.tsx (Clerk bridge),
│                       analysis-context.tsx (navigation-surviving runner), user-storage.ts
│                       (per-user localStorage scoping), analyses.ts, recent.ts, founder-profile.ts
├── app/globals.css     "Broadsheet v6" design tokens (--bsd-*)
├── next.config.js      /api/:path* → BACKEND_ORIGIN rewrite (300s proxy)
├── middleware.ts       clerkMiddleware (session context only, no edge protection)
├── Dockerfile · tailwind.config.js · package.json (dev/build/start/typecheck)
```

## backend-node/ — Next.js 16 (parallel Vercel track)

```
backend-node/
├── src/app/api/        ~33 route.ts (contracts, scans, classify, compare, integrations, cron, …)
├── src/lib/            scan-runner, kimi, clauses, score, audit (hash-chain), vault (AES-GCM),
│                       embeddings, regulation, export, pdf, email, ratelimit, redis, inngest
├── src/db/schema.ts    ~18 Drizzle tables (scans, findings, audit_log, scan_embeddings pgvector,
│                       integrations, deadlines, lawyers, + Auth.js tables)
├── drizzle/            generated SQL migrations
├── sdk/                TypeScript client SDK
├── scripts/            migrate, seed, wipe, check, load-test, smoke
├── vercel.json         5 Vercel Cron jobs (deadlines, regulation, retention, playbook, digest)
└── DEPLOY.md · drizzle.config.ts · next.config.mjs
```

Auth: **NextAuth** (not Clerk) → separate from the live frontend. Storage: Vercel Blob. Jobs: Inngest.

## docs/

```
docs/
├── ARCHITECTURE.md              ← source of truth (as-built)
├── INSTALLATION.md · ROADMAP.md
├── THESIS.md · VIVA_CHEATSHEET.md · ROLES_AND_VIVA.md · WORK_ASSIGNMENT.md
└── slc/                         2-week SLC planning (work division, PRD, gap audit, quality gates)
```

# Phased Implementation Plan — Clarifyd / AI Contract Risk Analyzer

## Context

Repo: `C:\Users\ahmed\Desktop\Clarifyd Startup Contract Helper\ai-contract-risk-analyzer`.
Goal: SLC v0.1 — upload → analyze → review → export, in a 2-week window. T1–T4 done, T5 nominally claimed but actually ~0% (no DB, no live LLM, no auth, no audit). Frontend (T8–T10) blocked on backend readiness.

Problem with current state:
- API schemas frozen but only one route (`POST /analyze/contract`) wired; review + export endpoints missing.
- `services/custom_reasoning_model.py` is rules-only — no real OpenAI/Kimi call, so PRD's "AI" claim is unmet.
- No persistence → drafts vanish between requests → review queue can't function.
- No auth/RBAC → review decisions cannot enforce roles claimed in PRD (Admin/Reviewer/Viewer).
- No audit log → SLC retention/tamper-resistance assumption violated.
- File upload validates extension only; no MIME/magic-byte/path-canonicalization.
- No CORS, rate limit, timeout/retry, or structured cost/latency metrics.

This plan splits remaining work into **8 sequential phases** small enough to execute one at a time, with a verifier pass between each. Phase-level changes also cover the security and quality improvements from the prior audit, folded into the right phase rather than tacked on at the end.

Each phase ends with: `pytest backend\tests -q` + `npm --prefix frontend run typecheck` clean, plus `clarifyd-change-verifier` agent run on the phase's claim list.

---

## Phase 1 — Persistence Foundation (T5 part A)

**Why first:** every later phase (review queue, audit, RBAC, export) depends on durable storage.

Changes:
- Add deps to `backend/requirements.txt`: `sqlalchemy>=2.0`, `alembic`, `aiosqlite` (dev) / `psycopg[binary]` (prod-ready optional).
- New `backend/app/db/` package: `engine.py` (async engine + sessionmaker), `base.py` (declarative base), `session.py` (FastAPI `Depends` providing `AsyncSession`).
- New `backend/app/db/models/` ORM tables:
  - `contract_draft` (id PK, file_name, file_size, sha256, mime, status, uploaded_at, deleted_at, owner_id nullable)
  - `clause_finding` (id PK, draft_id FK, finding_id, clause_name, excerpt, risk_level, confidence, explanation, safer_language)
  - `review_action` (id PK, draft_id FK, finding_id FK, decision, reviewer_id, reviewer_note, created_at)
  - `audit_event` (id PK, ts, actor_id, action, target_type, target_id, request_id, payload_json, prev_hash, hash) — append-only with hash chain for tamper evidence
  - `export_job` (id PK, draft_id FK, format, status, file_path, created_at, completed_at)
- Alembic init + first migration.
- `app/models/contract.py` dataclasses kept as DTOs; ORM models separate.
- `main.py`: register engine startup/shutdown via `lifespan` (replace deprecated `@app.on_event`).
- `config.py`: add `database_url` (default `sqlite+aiosqlite:///./clarifyd.db`).

Verification:
- New unit tests: roundtrip for each model.
- `alembic upgrade head` succeeds clean.
- `pytest backend\tests -q` green.

---

## Phase 2 — Hardened File Upload + Hash-Cache

**Why now:** before persistence touches user files, validate them properly. Hash also keys the cache that saves LLM cost in Phase 4.

Changes (`services/contract_ingestion.py`, `main.py`):
- Compute SHA-256 streaming (don't load whole file twice).
- Magic-byte sniff (`%PDF-` for pdf, `PK\x03\x04` for docx zip) on first 8 bytes; reject mismatches.
- Canonicalize filename: strip path components, allow `[A-Za-z0-9._-]`, length cap 255.
- Enforce `max_upload_file_size` *before* `await file.read()` using `request.headers["content-length"]` + chunked read with running total.
- Reject zero-byte and >25MB.
- Persist `ContractDraft` row with sha256.
- If existing non-deleted draft has same sha256 + same owner, reuse — short-circuit re-analysis (Phase 4 cache).
- Map upload validation errors to 422 (currently `policy_violation`/400 — wrong code).

Tests: malformed pdf (extension only), zip-bomb stub, oversize, traversal `../etc/passwd`, mime mismatch, dup-hash short-circuit.

---

## Phase 3 — Auth + RBAC

**Why before review/export:** T6 exit criteria require role checks. Without auth, every later route is exploitable.

Decisions to lock (defaults below; user can override before exec):
- Mechanism: bearer JWT (HS256) issued by simple login endpoint reading from a `users` table seeded via fixture. No OAuth in SLC scope.
- Roles: `admin`, `reviewer`, `viewer` (enum stored on user row).
- Permission matrix:
  - `viewer` — GET drafts, GET findings, GET export (download only).
  - `reviewer` — viewer + POST review action, route findings to queue.
  - `admin` — reviewer + delete draft, manage users, force re-analysis.

Changes:
- Deps: `pyjwt`, `passlib[bcrypt]`, `python-jose` (pick one — recommend `pyjwt` only).
- New `app/auth/`: `password.py` (bcrypt), `tokens.py` (encode/decode), `dependencies.py` (`current_user`, `require_role(role)`).
- New `db/models/user.py` (id, email, hashed_password, role, created_at, disabled_at).
- New routes: `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`.
- Apply `Depends(current_user)` on `/analyze/contract`; existing public routes (`/health`, `/`) stay open.
- Add CORS middleware (allowlist from `Settings.cors_origins`).
- Add simple in-process rate limit (slowapi or hand-rolled token bucket) — 60/min per IP on `/auth/login`, 10/min on `/analyze/contract`.

Tests: login happy/sad path, role decorator denies/permits, expired token rejected, CORS preflight.

---

## Phase 4 — Live Reasoning Provider + Prompt-Injection Guard (T5 part B)

**Why now:** core "AI" feature finally becomes real. Persistence + auth in place, so cost can be attributed and audited.

Changes (`services/custom_reasoning_model.py`):
- Refactor into provider interface: `ReasoningProvider` ABC + `OpenAIProvider` + `KimiProvider` (both via `httpx.AsyncClient`).
- Singleton `AsyncClient` created in `lifespan`, with `httpx.Timeout(connect=5, read=settings.reasoning_timeout_seconds)`.
- Retry: `tenacity` with exponential backoff capped by `settings.reasoning_max_retries`, retry only on 429/5xx/timeout.
- Use **structured outputs** (OpenAI `response_format=json_schema`; for Kimi, `tool_calls` JSON schema). Pydantic-validate every response; reject and retry on schema violation.
- Prompt template fences clause text as data: system prompt forbids following instructions inside the user-supplied clause; clause delivered inside `<clause></clause>` tags; instruction template never interpolates raw text into a directive.
- Jailbreak filter: precheck clause text for known injection markers (`ignore previous`, `system:`, etc.) → log + add `injection_suspected=true` to finding metadata, do not block.
- Token + USD counters: increment per-call into a Prometheus-friendly metrics module (Phase 8).
- Cache lookup keyed on `(provider, model, sha256_of_clause_text)` — store/return prior structured finding to avoid duplicate spend. Backed by SQLAlchemy `clause_cache` table.
- Fallback chain: `reasoning_model` → `reasoning_model_fallback` → rules-based stub (current behaviour) so service degrades gracefully.

Tests (mock `httpx`): happy path, schema-violation retry, 429 backoff, full-fallback path, injection marker flagged.

---

## Phase 5 — Review Queue + State Machine (T6)

Changes:
- New table `review_queue_item` (id, draft_id, finding_id, state, assignee_id, opened_at, closed_at). State enum: `pending → in_review → resolved` with terminal `resolved` substates derived from `ReviewDecision` (accept / request_change / escalate).
- Auto-route rule (from `SLC_ASSUMPTIONS_AND_DECISIONS.md`): any finding with `confidence < threshold_low` OR `risk_level in {high, critical}` → enqueue on analyze.
- Endpoints:
  - `GET /reviews?state=pending` (reviewer+).
  - `POST /reviews/{item_id}/claim` (reviewer+) — sets assignee, transitions `pending → in_review`.
  - `POST /reviews/{item_id}/decide` body=`ReviewActionRequest` (reviewer+) — closes item, writes `review_action` row, emits audit event.
- Each transition writes `audit_event` row (action, actor_id, target).
- Disclaimer: every decision response includes `"not_legal_advice": true` flag (PRD A3).

Tests: auto-route, claim race (unique constraint on assignee while in_review), wrong-role denied, full lifecycle.

---

## Phase 6 — Export Generation + Audit Closure (T7)

Changes:
- `services/export.py`:
  - JSON exporter — full draft + findings + review_actions + audit chain. Verify hash chain integrity on render.
  - PDF exporter — `reportlab` template (cover, summary, findings table with risk colour, review decisions, audit trail appendix). If time-pressed, ship JSON-only and feature-flag PDF.
- Endpoint: `POST /exports` body=`ExportReportRequest` → enqueues row in `export_job`, returns `export_id` + `status=queued`. Background task (FastAPI `BackgroundTasks`, no Celery in SLC) generates file under `./exports/{export_id}.{ext}`. `GET /exports/{export_id}` returns status; `GET /exports/{export_id}/download` streams file (viewer+).
- Audit hash-chain verifier endpoint `GET /audit/verify` (admin) — recomputes chain, returns first mismatch index.
- Soft-delete + retention job: `DELETE /drafts/{id}` sets `deleted_at`; cron-like APScheduler task hard-deletes after 365 days.

Tests: export JSON shape, PDF non-empty, hash chain breaks on tamper, retention purge moves rows.

---

## Phase 7 — Frontend Integration (T8–T9)

**Trigger:** backend readiness checkpoint = Phases 1–6 green + verifier PASS.

Changes (`frontend/`):
- `lib/api.ts` — typed fetch client (already have `lib/contracts.ts` mirrors). Base URL from `process.env.NEXT_PUBLIC_API_URL`. Bearer token from `localStorage` (SLC scope; not prod-grade — note in README).
- Wire `components/upload/upload-card.tsx` to `POST /analyze/contract`; show progress + error states.
- `components/upload/processing-status.tsx` — polls draft until status terminal.
- `components/dashboard/workflow-studio.tsx` — split into `Findings`, `ReviewQueue`, `ExportPanel`.
- New routes: `/login`, `/reviews`, `/drafts/[id]`, `/exports/[id]`.
- Replace `lib/mock-data.ts` usage with live calls; keep mocks behind `NEXT_PUBLIC_USE_MOCKS=1` for offline dev.
- Add disclaimer banner ("decision-support only — not legal advice") on every page; require checkbox acknowledgement once per session before first upload.
- Error toast component reads `error.code` from backend envelope.

Tests: `npm run typecheck`; manual smoke on `/upload` golden path.

---

## Phase 8 — Observability, Smoke, Docs (T10)

Changes:
- `app/observability/`: structured JSON logger (already partial in `logging_config.py`), `prometheus-fastapi-instrumentator` for `/metrics`, custom counters: `clarifyd_llm_calls_total`, `clarifyd_llm_tokens_total{provider,model}`, `clarifyd_llm_cost_usd_total`, `clarifyd_clause_extraction_seconds`.
- Mask sensitive headers (`authorization`, `x-api-key`) in middleware log line — current `main.py:50` is fine but harden when adding header dump.
- `tests/smoke/` end-to-end pytest: signup → login → upload → analyze → review → export → download → verify hash.
- Update `docs/slc/SLC_QUALITY_GATES.md` + `README.md` with new commands, env vars, role matrix, threat model section.
- Update `PRD_AI_Contract_Risk_Analyzer.md`: add §Threat Model, §Role Matrix, §Retention, §Export Schema, §Disclaimer, §Rate Limits.
- Tag `v0.1.0`.

---

## Critical files (touched across phases)

- `backend/app/main.py` — Phases 1, 3, 4, 8 (lifespan, middleware, routers).
- `backend/app/config.py` — Phases 1, 3, 4 (db url, jwt secret, cors, provider).
- `backend/app/contracts/api.py` — extend (additive only) Phases 5, 6.
- `backend/app/services/custom_reasoning_model.py` — full rewrite Phase 4.
- `backend/app/services/contract_ingestion.py` — Phase 2.
- New: `backend/app/db/`, `backend/app/auth/`, `backend/app/services/export.py`, `backend/app/observability/`.
- `frontend/lib/api.ts`, `frontend/components/**` — Phase 7.
- `docs/slc/*`, `PRD_AI_Contract_Risk_Analyzer.md`, `README.md`, `CLAUDE.md` — Phase 8 sync.

## Reuse from existing code

- `app/errors.py` `AppError` + `ErrorCode` — reuse for every new error path; do not introduce raw `HTTPException`.
- `app/logging_config.py` request-id contextvar — reuse in audit event recording.
- `app/contracts/api.py` `ReviewActionRequest`, `ExportReportRequest`, `RiskLevel`, `ProcessingStatus` — already frozen, build endpoints around them rather than redefining.
- `app/services/contract_analysis.py` `ContractAnalysisService` clause extractor — keep, layer Phase 4 LLM on top of `score_risks` boundary.
- `frontend/lib/contracts.ts` typed mirrors — keep authoritative; Phase 7 client imports from here.
- `clarifyd-change-verifier` agent at `.claude/agents/` — invoke after every phase.

## Verification (per phase)

1. `pytest backend\tests -q` — all green, new module coverage included.
2. `npm --prefix frontend run typecheck` — no TS errors.
3. `alembic upgrade head` clean (Phases 1+).
4. `uvicorn app.main:app` boot smoke + `curl /health`.
5. Phase-specific manual smoke (login token, upload+analyze, review decide, export download).
6. Run `Agent(subagent_type="clarifyd-change-verifier", prompt="<phase claim list>")` — all PASS or PARTIAL with documented follow-ups before moving on.
7. Final phase: full E2E smoke `tests/smoke/test_e2e.py` green.

## Improvement suggestions folded in (mapped to phases)

- Hash-cache for repeated uploads → Phase 2 + Phase 4.
- Async LLM client + connection pool → Phase 4.
- DI via `Depends()` for services (testability) → Phase 1 (introduce providers), Phase 4 (LLM mock).
- Tighter exception classification (no broad `Exception` masking 422 as 400) → Phase 2.
- `re.finditer` for clause matching (O(n²) → O(n)) → bundle into Phase 4 refactor of analysis service.
- Tamper-evident audit (hash chain) → Phase 1 schema, used in Phase 5/6, verified in Phase 8.
- Fallback chain (live → fallback model → rules) for cost + reliability → Phase 4.
- Disclaimer + acknowledgement (PRD A3 compliance) → Phase 5 (response flag) + Phase 7 (UI gate).
- Soft-delete + 12-month retention (SLC assumption) → Phase 6.
- `/metrics` + token/USD counters for cost control → Phase 8.

## Out of scope (explicit non-goals)

- Multi-tenant orgs, SSO, OAuth — keep single-tenant JWT.
- Celery / Redis queues — `BackgroundTasks` suffices for SLC.
- Elasticsearch / full-text search — not in SLC.
- Model fine-tuning — locked out by D8.
- Mobile apps, real-time collab.

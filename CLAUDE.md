# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Session start:** read `PROGRESS.md` (project root) FIRST — it is the living cross-session state log (open branches, current task, page-build status). Update it before ending each session.

## Project

**Clarifyd / AI Contract Risk Analyzer** — SLC (Simple, Loveable, Complete) deliverable for **pre-seed founders**. One workflow: upload → analyze → review → export. Reasoning is exposed product-side as **Clarifyd AI** (provider abstraction in `app/services/reasoning/`, swappable via `Settings`). No model training in this repo.

Frontend is **Broadsheet v6** — brutalist editorial. Warm ivory paper, coffee-black ink, single arterial red accent. Geist + Geist Mono, Phosphor duotone icons. Sharp edges, no gradients / glass / shadows. Per-user `localStorage` scoping via `lib/user-storage.ts`.

Authoritative planning docs (read these before non-trivial changes):
- `docs/slc/SLC_2_WEEK_WORK_DIVISION.md` — task matrix T1–T10 and exit criteria.
- `docs/slc/SLC_PRD_AI_Contract_Risk_Analyzer.md` — product spec.
- `docs/slc/SLC_ASSUMPTIONS_AND_DECISIONS.md` — confidence thresholds, retention, scope locks.
- Top-level `PRD_AI_Contract_Risk_Analyzer.md` (one directory up) is the upstream PRD.

> The structure described in `PROJECT_STRUCTURE.md` is **aspirational** (full extended PRD) and does not match the SLC scope actually being built. When the two conflict, the `docs/slc/` files win.

## Common commands

PowerShell on Windows is the primary shell. All commands assume repo root unless noted.

### Backend (FastAPI, Python 3.11+)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Tests:
```powershell
pytest backend\tests -q                                          # all backend tests
pytest backend\tests\unit\test_contract_analysis_service.py -q   # one file
pytest backend\tests -q -k "ingestion"                           # by keyword
pytest backend\tests -q -x --ff                                  # stop on first fail, prior fails first
```

### Frontend (Next.js 14, React 18, TypeScript)
```powershell
cd frontend
npm install
npm run dev          # dev server on http://localhost:3000
npm run build
npm run typecheck    # tsc --noEmit — required CI gate
```

### Full stack
```powershell
docker compose up --build
```
Health: `http://localhost:8000/health` · API root: `http://localhost:8000/` · UI: `http://localhost:3000`.

### Phase 1 / CI validation gate (run before PR)
```powershell
pytest backend\tests -q
npm --prefix frontend run typecheck
```

## Architecture

### Backend layering (`backend/app/`)
Strict separation; do not collapse layers:

- `main.py` — FastAPI app, middleware (request-id + timing), exception handlers, route definitions. Services are instantiated **once at module scope** (`ingestion_service`, `analysis_service`, `text_extractor`).
- `config.py` — `Settings` via `pydantic-settings`, cached through `@lru_cache get_settings()`. `reasoning_provider` is validated to `{"openai", "kimi"}`. All env config flows through here; do not read `os.environ` elsewhere.
- `contracts/` — frozen Pydantic API schemas (`api.py`) plus internal data contracts (`ingestion.py`, `analysis.py`). **These shapes are the contract between backend and frontend B and must not change without an explicit T1-style schema review.**
- `services/` — pure business logic, no FastAPI imports:
  - `contract_ingestion.py` — file validation, draft creation.
  - `contract_text_extractor.py` — PDF/DOCX → text.
  - `contract_analysis.py` — clause tagging + risk scoring (rules-based today).
  - `custom_reasoning_model.py` — stub for the external LLM provider call. Currently rules-only; live provider wiring is T5.
- `models/` — domain dataclasses (e.g., `ContractDraft`). **Not** SQLAlchemy yet; persistence layer arrives in T5.
- `errors.py` + `logging_config.py` — `AppError` / `ErrorCode` exception model and request-id-aware logging. New error paths must raise `AppError`, not bare `HTTPException`, so the unified error envelope (`{error: {code, message, details, request_id}}`) is preserved.

### Frontend (`frontend/`)
Next.js App Router. `app/` holds routes (`page.tsx`, `upload/`, `api/`); `components/` and `lib/` are shells awaiting T8 wiring. No runtime API calls yet — by design, frontend implementation starts only after the Week-2 backend readiness checkpoint.

### Request lifecycle
1. `request_context_middleware` assigns/propagates `X-Request-ID` and times the request.
2. Route handler validates input, delegates to a service, maps the service result to a `contracts/api.py` response model.
3. `AppError` → structured JSON via `handle_app_error`; `RequestValidationError` → 422 envelope; everything else → 500 via `handle_unexpected_error` (logs with `exc_info`, never leaks internals).

### Reasoning provider
Provider, base URL, model, fallback, timeout, and retry caps all live in `Settings`. Two providers are supported (`openai`, `kimi`) — keep the abstraction in `services/custom_reasoning_model.py` so swapping providers is config-only.

### Reasoning Model API (product surface — PRD §4.12)

The reasoning engine is also a **first-class HTTP API**, not just an internal call site. Future work must not duplicate provider logic — extend the existing modules.

- **Implementation seat:** `app/services/reasoning/` (built in Phase 4). Already houses `ReasoningProvider` ABC, `OpenAIProvider`, `KimiProvider`, `RulesBasedProvider`, `FallbackChainProvider`, `prompts.py`, `injection.py`. Do **not** create a sibling package; extend `prompts.py` with a `founder_guidance_prompt(clause, startup_profile)` builder.
- **Route module:** `app/routes/reasoning.py` exposes:
  - `POST /api/v1/reasoning/evaluate` — viewer+ — submit `draft_id` (or raw text) → ranked findings + founder guidance.
  - `POST /api/v1/reasoning/guidance` — viewer+ — follow-up legal-guidance question scoped to `draft_id` / `finding_id`.
  - `GET /api/v1/reasoning/categories` — public — supported clause taxonomy.
  - `GET /api/v1/reasoning/jobs/{job_id}` — viewer+ — poll long-running evaluation.
- **Response models** live in `contracts/api.py` as `ReasoningEvaluateResponse`, `ReasoningFinding`, `FounderGuidance`. Schemas were frozen at T1 — extensions must be **additive only** with default `None`, and require Group Mate B sign-off.
- **Sort invariant:** `findings` ordered by `(risk_level desc, risk_score desc, confidence desc)` — enforced in the service layer and asserted in `tests/unit/test_reasoning_ranking.py`.
- **Disclaimer is mandatory:** every reasoning response must carry `not_legal_advice: true` and the canonical disclaimer string (PRD A3). Schema-enforced; do not strip it in any wrapper.
- **Founder advisor:** `POST /reasoning/guidance` **refuses jurisdiction-specific legal opinions** and returns a "consult licensed counsel" CTA instead. Tailor framing using the user's `startup_profile` (stage, jurisdiction hint, sector); per-user with per-draft override.
- **Metrics:** new Prometheus counters live next to `clarifyd_llm_*` in `app/observability/`:
  - `clarifyd_reasoning_calls_total`
  - `clarifyd_reasoning_tokens_total{provider,model}`
  - `clarifyd_reasoning_cost_usd_total`
  - `clarifyd_reasoning_latency_seconds`
- **Cache:** reuse the existing per-clause key `(provider, model, sha256(clause_text))` — do not add a second cache.
- **Audit:** emit `append_audit_event(action="reasoning.evaluate", ...)` per call so the hash chain captures spend + actor.
- **Persistence:** founder-guidance text hangs off `clause_finding.payload_json` initially; promote to a sibling `guidance_json` column only when querying by guidance attribute becomes a need.

## SLC delivery rules (non-obvious)

- **Backend-first is locked.** No frontend implementation work in Week 1; frontend (T8–T10) starts only after the Week-2 backend readiness checkpoint passes.
- API request/response schemas in `contracts/api.py` were **frozen at T1**. Changes require Group Mate B sign-off.
- Confidence thresholds and review-routing rules come from `SLC_ASSUMPTIONS_AND_DECISIONS.md`; do not invent thresholds in code.
- If a blocker exceeds 1 day, re-scope **within** SLC boundaries in the same week — do not slip to a later week.
- Reasoning API responses are user-visible; every response must include `not_legal_advice: true` and the canonical disclaimer string (PRD §4.12 / A3).

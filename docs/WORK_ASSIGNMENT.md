# Clarifyd — Definitive Work Assignment (file-level, zero assumptions)

> Built by walking the **entire** repository and mapping **every file** to exactly one of four members.
> Domains were derived from how the code actually divides, not from preset job titles.
> Companion docs: `THESIS.md` (system report), `ROLES_AND_VIVA.md` (per-person Q&A). Where they differ, **this file wins** — it is file-verified.
> Clarifyd is **decision-support, not legal advice.**

## The four members & derived domains

| Member | Roll No. | Domain (derived from the code) | Scale |
|---|---|---|---|
| **Ahmad Arshad** | 2k22-BSCS-404 | **★ Reasoning Core & Server Platform** — the hardest module (LLM reliability + safety) **plus** API, persistence, infra | Reasoning fallback/injection/schema engine · 18 Py routes · 16 DB models · Drizzle schema · 33 Node routes · deploy |
| **Awais Khan** | 2k22-BSCS-446 | **★★ Client Application** — entire Next.js frontend + the real-time client/auth architecture (2nd-hardest) | 33 pages · 43 components · 11 lib modules |
| **Taha Khan** | 2k21-BSCS-329 | **Feature Endpoints & Contract Utilities (lightest build)** — deterministic, no-LLM features | simplify · compliance · compare · search · negotiate · detector · taxonomy/templates |
| **Wasif Azeem** | 2k22-BSCS-422 | **Quality & Verification (lightest build)** — run/maintain tests, CI gate, smoke/load, docs | executes 124 tests · benchmark run · smoke/load · quality docs |

**Difficulty ladder (as assigned):**
- **Hardest → Ahmad** (§2 ★): the LLM reliability + safety engine (fallback chain, injection defense, schema-constrained output, serverless resilience) **plus** the heavy AI content services (analysis orchestration, grounded report, sweeps, rubric) and the full server/DB/infra. Headline contribution.
- **2nd-hardest → Awais** (§1 ★★): the entire frontend + the real-time client/auth architecture (nav-surviving analysis, JWT lifecycle, streaming, provider boundary).
- **Lightest → Taha** (§3): the deterministic, no-LLM feature endpoints (simplify/compliance/compare/search/negotiate/detector) + taxonomy/templates. Simple, self-contained code.
- **Lightest → Wasif** (§4): running & maintaining the existing test suite, CI gate, smoke/load scripts, and the QA/viva docs. Verification and execution, not systems-building.

**Coverage guarantee:** every file is assigned; the shared *boundary* is drawn explicitly in §5.

---

## 1. Awais Khan — ★★ Client Application (Frontend)  ·  2k22-BSCS-446

**Owns 100% of `frontend/`, including the second-hardest module (the real-time client architecture).**

### ★★ SECOND-HARDEST PART — Real-Time Client & Auth Architecture
The toughest frontend engineering: keeping a long-running (~120 s) analysis and a streaming AI alive across a stateless, auth-gated SPA.
- `lib/analysis-context.tsx` — a **global analysis runner mounted above the route outlet** so an in-flight analysis **survives navigation**, with a single-flight guard and a persistent progress pill. Naïvely this state dies on route change; hoisting it into a provider is the hard fix.
- `lib/auth.tsx` — **Clerk JWT lifecycle**: tokens expire ~60 s, so a fresh JWT is minted **per request** and refreshed on a 30 s timer, mapped to a local `Me` with role — without bouncing the user on refresh.
- `components/conditional-providers.tsx` — a **route-aware provider boundary** that boots ClerkProvider only on app routes and a Clerk-free stub on marketing routes (bundle/LCP win) — one wrong branch and public pages break or ship 220 KB of auth JS.
- Streaming copilot — `app/copilot/page.tsx` consumes an **SSE token-by-token stream** (`copilotGuidanceStream`) and renders incrementally.
- `lib/user-storage.ts` — per-user localStorage scoping so a shared device never leaks one user's drafts into another's session.

**Why it's second-hardest:** it's distributed-state-on-the-client — async lifecycles (long request + token expiry + streaming) that must not drop, bounce, or leak across navigation and auth boundaries. Hard to get right, easy to demo when it works.

### Pages (`app/*/page.tsx` — 33)
Live app: `dashboard`, `findings`, `copilot`, `negotiation`, `negotiate`, `reasoning`, `library`, `exports`, `profile`, `admin`, `feedback`, `integrations`, `simplify`, `search`, `comments`, `reviews`, `lawyer`, `upload`.
Auth/onboarding: `login/[[...rest]]`, `login/verify`, `oauth/callback`, `onboarding/profile`.
Public: `/` (landing), `pricing`, `faq`, `contact`, `terms`, `security`, `changelog`, `status`.
Previews (non-prod): `dashboard-preview`, `copilot/preview`, `landing-preview`.
Root: `app/layout.tsx`, `app/loading.tsx`, `app/globals.css`.

### Components (`components/` — 43)
Shell/nav: `shell/dark-app-shell` (the live shell), `shell/app-shell`, `shell/side-nav`, `shell/desktop-rail`, `shell/arc-mobile-nav`, `shell/audit-chain-badge`, `public-shell`, `conditional-providers`.
Findings: `clause-card`, `health-gauge`, `risk-pill`, `findings/verdict-card`, `findings/findings-list`, `findings/contract-report-card`, `findings/confidence-ring`.
Intake: `auto-classify-chip`, `context-selector`, `broadsheet-search`, `broadsheet-textfield`, `upload/upload-card`, `upload/processing-status`, `upload/recent-drafts`, `common/draft-picker`.
Feature panels: `exports/export-panel`, `reviews/review-queue`, `integrations-panel`, `deadline-monitor`, `lawyer-escape-hatch`, `overview/overview-dashboard`, `contact/contact-form`.
Admin: `admin/audit-verify-card`, `admin/soft-delete-form`, `admin/webhooks-panel`.
Chrome/legal: `notice-modal`, `disclaimer/disclaimer-banner`, `common/nav-progress`, `common/cookie-consent`, `common/premium-cursor`, `common/aurora-background`, `common/scroll-reveal`, `common/reveal-children`, `common/skeleton`, `common/orbital-loader`.

### State/data layer (`lib/` — 11)
`api.ts` (typed API client — every backend surface), `auth.tsx` (Clerk bridge, JWT-per-request), `user-storage.ts` (per-user localStorage scoping), `analysis-context.tsx` (global analysis runner), `analyses.ts`, `recent.ts`, `founder-profile.ts`, `contracts.ts` (frozen client types), `startup-templates.ts`, `toast.tsx`, `use-is-mobile.ts`.

### What Awais built
The whole user experience: the "Broadsheet v6" design system (tokens in `globals.css`), all page flows, the Clerk auth integration with per-request JWT refresh, the route-aware provider boundary that keeps ClerkJS off marketing pages, per-user storage scoping, the global analysis runner that survives navigation, and the mobile responsive safety net.

### Defense one-liners
- Flow: dashboard intake → `analysis-context` → `api.ts` → findings (health gauge + clause diffs) → copilot/exports.
- Clerk JWT expires ~60 s → `auth.tsx` mints fresh per request.
- Marketing pages run under a Clerk-free stub (LCP/bundle win).
- Browser never persists raw contract text (`analyses.ts` strips `extracted_text`).
- **Honest trap:** some components are reusable building blocks not wired to a live route (`upload/*`, `findings/findings-list`, `overview-dashboard`, `deadline-monitor`, `lawyer-escape-hatch`, `admin/*`) — live pages reimplement inline.

---

## 2. Ahmad Arshad — ★ Reasoning Core & Server Platform  ·  2k22-BSCS-404

**Owns the hardest module (LLM reliability + safety engine) AND the API surface, persistence, infrastructure, and security plumbing of both backends.**

### ★ THE HARDEST PART — LLM Reliability & Safety Engine (`backend/app/services/reasoning/`)
This is the project's headline contribution and the toughest engineering: making a non-deterministic, injectable, sometimes-down LLM safe to ship in a legal product.
- `chain.py` — **`FallbackChainProvider`**: sequential fallthrough so a provider failure degrades gracefully instead of hard-failing.
- `provider.py` — the `ReasoningProvider` ABC + `ClauseAssessment` schema + `ProviderError`/`SchemaViolationError` contract.
- `openai_provider.py` / `kimi_provider.py` — **schema-constrained structured output** (`response_format` JSON), `temperature=0`, **tenacity exponential-backoff retry** on `{408,409,425,429,500,502,503,504}` and schema violations.
- `rules_provider.py` — deterministic backstop so analysis still returns with **no** API key / total outage.
- `injection.py` — **prompt-injection defense**: `detect_injection()` regex + clause fencing as untrusted `<clause>` data + closing-tag neutralization; suspects force-routed to human review.
- **Serverless resilience** (in `main.py`) — Vercel doesn't fire `lifespan` and reuses closed event loops → lazy per-request rebuild of services + httpx client. This bug emptied findings in production; the fix is Ahmad's.

**Why it's the hardest:** it spans distributed-systems failure handling (retry/fallback), adversarial security (injection), schema/validation engineering, and serverless runtime quirks — the four things most likely to break and most impressive to defend. Every claim here is covered by `test_reasoning_provider.py` (11 tests).

### Heavy AI content services (`backend/app/services/`)
Beyond the reliability engine, Ahmad also owns the compute-heavy AI logic: `async_contract_analysis.py` (parallel per-clause orchestration, concurrency 8, `ClauseCache`), `contract_reporter.py` (grounded full report — seed-lock, citation grounding, suggestion validation, byte-stable cache), `loophole_sweep.py` (present + **missing**-clause sweep), `ambiguity_sweep.py` (vague-term detection), `copilot_advisor.py` (streaming chat), and the prompt/rubric in `reasoning/prompts.py`. (The *simple, deterministic* feature endpoints are Taha's; see §3 / §5.)

### Server & Data Platform

### Python API — routes (`backend/app/routes/` — 18)
`admin`, `analyses`, `auth`, `comments`, `compare`, `compliance`, `contact`, `exports`, `feedback`, `negotiate`, `oauth`, `reasoning`, `reviews`, `search`, `simplify`, `webhooks`, `workflow`, `__init__`.

### Python app core (`backend/app/`)
`main.py` (app bootstrap, middleware, exception handlers, CORS, security headers, analysis semaphore), `config.py` (cached `Settings`, provider validation, Neon URL rewriting), `errors.py` (`AppError`/`ErrorCode`), `rate_limit.py` (sliding-window limiter), `logging_config.py` (request-id logging), `cli.py` (admin/user management).

### Persistence (`backend/app/db/models/` — 16) + migrations
`user`, `oauth_identity`, `email_verification`, `contract_draft`, `clause_finding`, `review_queue_item`, `review_action`, `export_job`, `audit_event`, `clause_cache`, `report_cache`, `comment`, `webhook`, `feedback`, `contact_message`, `__init__`.
Alembic: `20260510_0001_phase1_baseline`, `..0002_user_table`, `..0003_clause_cache`, `20260517_0001_report_cache`, `alembic/env.py`.

### Contracts & platform services
`contracts/api.py` (frozen `API_CONTRACT_VERSION="2026-05-week1-freeze"`), `contracts/analysis.py`, `contracts/ingestion.py`; `services/audit.py` (SHA-256 hash chain), `services/export.py` (JSON/PDF export jobs), `services/contract_ingestion.py` (upload validation, magic-byte sniff), `services/contract_text_extractor.py` (PDF/DOCX/TXT), `services/email.py`; `observability/metrics.py` (Prometheus registry).

### Node backend — server/data plumbing (`backend-node/`)
API routes (33): contracts, scans (+id/findings/stream/export), clauses, audit, auth (NextAuth), me, consent, health, integrations (connect/callback/disconnect/webhook), monitor/deadlines, lawyers, lawyer-handoff, admin/lawyers, security/posture, user/context, cron, dev/session, inngest.
Lib plumbing: `db/schema.ts` + `db/index.ts` (Drizzle, 20+ tables), `auth.ts` (Auth.js), `vault.ts` (AES-256-GCM), `ratelimit.ts`, `redis.ts`, `export.ts`, `pdf.ts`, `pii.ts`, `hash.ts`, `admin.ts`, `observability.ts`, `email.ts`, `inngest.ts` (job host/schedules).
Node AI libs (Ahmad, with the heavy-AI hat): `kimi.ts` (NIM/Kimi client + injection sentinels), `embeddings.ts` (pgvector), `score.ts` (health scoring), `clauses.ts` (taxonomy tagging), `scan-runner.ts` (scan pipeline), `regulation.ts` (RSS diffing).

### Deployment/infra
`backend/Dockerfile`, `docker-compose.yml`, Vercel/DigitalOcean specs, Clerk RS256 verification, prod hardening.

### What Ahmad built
Every HTTP endpoint and its contract, the 16-table relational schema + migrations, the tamper-evident audit log, role-gated review queue with race-safe claim, upload/SSRF/IDOR security guards, rate limiting, the unified error envelope, and the deployment path (Docker + serverless + Neon).

### Defense one-liners
- ★ Fallback chain: tenacity retry on 408/409/425/429/5xx → fallback Llama (nemotron-49b) → deterministic rules. **Never returns nothing.**
- ★ Injection: contract fenced as untrusted `<clause>`, tags neutralized, `injection_suspected` → force human review.
- ★ Schema safety: LLM output validated against a JSON schema; violation triggers retry then fallthrough.
- ★ Serverless bug: Vercel skips `lifespan` + httpx bound to a closed event loop → lazy per-request rebuild (fixed empty-findings in prod).
- Layers: `main.py` → `routes/` → `services/` → `db/models/`. Config only via cached `Settings`.
- Audit = SHA-256 chain (`prevHash`+`thisHash`); `GET /audit/verify` detects tampering.
- Review routing: `high/critical` OR `confidence<0.7` OR `injection_suspected`; claim via race-safe conditional UPDATE.
- **Honest trap:** the Node backend is broader but **undeployed/unmerged**; Python is the live path.

---

## 3. Taha Khan — Feature Endpoints & Contract Utilities (lightest build)  ·  2k21-BSCS-329

> **Framing:** Taha owns the **deterministic, no-LLM** parts of the product — the feature endpoints that are plain rules/SQL/regex, plus the contract taxonomy and template data. These are self-contained and the simplest to reason about (no distributed failure handling, no LLM orchestration). Still real, ownable, and demoable. **Note:** there is **no trained model** anywhere (Decision D8) — if asked "where's the ML," the honest team answer is "applied LLM in Ahmad's engine; the rest is deterministic rules," and Taha owns the deterministic rules.

### Deterministic feature endpoints (`backend/app/routes/` + backing logic)
- `simplify.py` — plain-English rewrite via **regex/lowercasing + key-term extraction** (no LLM).
- `compliance.py` — **static regulation→clause rule map** (GDPR/CCPA/HIPAA/FCPA).
- `compare.py` — clause-variance across ≥2 owned drafts via **SQL**.
- `search.py` — **SQL `ilike`** over excerpt/clause/explanation.
- `negotiate.py` — **template** counter-offers per clause type (static, not LLM).
- `contract_detector.py` — heuristic non-contract gate (keyword density, negative markers).

### Contract taxonomy & rules (`backend/app/services/custom_reasoning_model.py`)
The **keyword clause lexicon** (10 clause types) + the rules risk-scorer trigger table + the safer-language library. Deterministic and testable — the "rules" half of the analyzer.

### Data & templates
`backend/app/services/contract_analysis.py` (sentence-split / heading-fusion clause segmentation), plus `frontend/lib/startup-templates.ts` content and the clause taxonomy the Library/Copilot use.

### What Taha built
The deterministic feature surface: the simplify/compliance/compare/search/negotiate endpoints, the non-contract detector, and the clause taxonomy + rules-scoring tables that back the fallback path. No external API dependency — these run and pass tests offline.

### Defense one-liners
- These features are **pure logic** — regex (simplify), static maps (compliance), SQL (compare/search), templates (negotiate). Easy to trace, deterministic outputs.
- Clause classification = deterministic keyword lexicon (fast, reproducible); the **LLM risk judgment** sits in Ahmad's engine.
- The rules scorer is the **fallback** that keeps the product working with no API key (ties into Ahmad's fallback chain).
- **Honest note:** `simplify`/`search`/`comments` pages are thin utility UIs; `compare`/`compliance` are API-only (no dedicated page).

---

## 4. Wasif Azeem — Quality, Testing & Release (QA)  ·  2k22-BSCS-422

**Owns all verification across the repo.**

### Test suite (`backend/tests/` — 124 functions / 20 files) — exact counts
| File | Tests | Guards (whose module) |
|---|---|---|
| `test_upload_security.py` | 14 | Ahmad — upload guards |
| `test_contract_reporter_guardrails.py` | 16 | Taha — report grounding |
| `test_reasoning_provider.py` | 11 | Taha — injection/retry/fallback |
| `test_auth.py` | 11 | Ahmad — auth/roles/rate-limit |
| `test_exports.py` | 9 | Ahmad — exports |
| `test_features_all.py` | 8 | Ahmad/Taha — §4.x features |
| `test_analyze_endpoint.py` | 7 | Ahmad — analyze endpoint |
| `test_reasoning_api.py` | 6 | Taha — ranking + disclaimer |
| `test_reviews.py` | 6 | Ahmad — review queue |
| `test_db_models.py` | 6 | Ahmad — schema + audit tamper |
| `test_api_contracts.py` | 5 | Ahmad — frozen contracts |
| `test_async_analysis.py` | 4 | Taha — parallel scoring |
| `test_contract_analysis_service.py` | 4 | Taha — clause extraction |
| `test_security_audit.py` | 4 | Ahmad — SSRF + IDOR |
| `test_contract_ingestion_service.py` | 3 | Ahmad — ingestion |
| `test_contract_text_extractor.py` | 3 | Ahmad — extraction |
| `test_custom_reasoning_model.py` | 3 | Taha — rules model |
| `test_infra_baseline.py` | 3 | Ahmad — infra policy |
| `test_kimi_quality.py` (benchmark) | 1 | Taha — live LLM quality |
| **Total** | **124** | |
Plus `conftest.py` (fixtures) and `pytest.ini` (`addopts=-m "not benchmark"`).

### Release/QA tooling
Node smoke/load/regression: `scripts/smoke.sh`, `scripts/load-test.js`, `scripts/injection-corpus.ts`, `scripts/check.ts`, `scripts/test-reg.ts`; seed/migrate/wipe utilities. CI gate: `pytest backend/tests` + `npm --prefix frontend run typecheck`. Secret scanning: gitleaks. Quality docs: `docs/slc/SLC_QUALITY_GATES.md`, acceptance criteria in the SLC pack.

### What Wasif built
The verification backbone: 124 backend tests spanning security (upload, SSRF, IDOR), the reasoning pipeline (injection, retry, fallback, ranking), report guardrails (byte-stable, citation-grounded), and audit-tamper detection; the two-command CI gate; the offline/online test split (mocked unit tests in CI vs live LLM benchmark on demand); and the Node smoke/load/injection-corpus scripts.

### Defense one-liners
- CI gate = `pytest` + frontend `typecheck`; benchmarks excluded so CI is fast/offline.
- Testing a fuzzy LLM: deterministic unit tests (structure/ranking/disclaimer/fallback) + separate live `@benchmark` corpus.
- Audit-tamper test mutates a mid-chain event and asserts `verify` reports the break.
- Security: traversal/MIME-spoof/size (14 tests), SSRF + IDOR (4 tests), gitleaks in CI.
- **Honest trap:** frontend has **no** unit/E2E runner — typecheck is the only frontend gate; next step is Playwright E2E.

---

## 5. The shared boundary (memorize — examiners probe this)

`backend/app/services/` is where Ahmad and Taha meet:
- **Ahmad** owns the *hard* services: everything in `reasoning/` (fallback/injection/schema) + `async_contract_analysis`, `contract_reporter`, `loophole_sweep`, `ambiguity_sweep`, `copilot_advisor`, `prompts.py`, plus platform services `audit`, `export`, `contract_ingestion`, `contract_text_extractor`, `email`.
- **Taha** owns the *easy, deterministic* pieces: the feature endpoints (`simplify`, `compliance`, `compare`, `search`, `negotiate`), `contract_detector`, and the rules/taxonomy in `custom_reasoning_model` + `contract_analysis`.
- One sentence each: **Ahmad** — "I built the LLM engine and the whole server." **Taha** — "I built the deterministic rule-based features on top of it." **Awais** — "I built everything the user sees and the real-time client state." **Wasif** — "I verify all of it — 124 tests and the CI gate."

## 6. Roster — name → role → hardness

| Name | Roll No. | Role | Difficulty |
|---|---|---|---|
| **Ahmad Arshad** | 2k22-BSCS-404 | Reasoning Core & Server Platform (LLM reliability/safety engine + full backend) | ★ Hardest |
| **Awais Khan** | 2k22-BSCS-446 | Client Application (full frontend + real-time client/auth architecture) | ★★ 2nd-hardest |
| **Taha Khan** | 2k21-BSCS-329 | Feature Endpoints & Contract Utilities (deterministic, no-LLM features) | Lightest |
| **Wasif Azeem** | 2k22-BSCS-422 | Quality & Verification (run/maintain tests, CI gate, smoke/load, docs) | Lightest |

## 7. Whole-project coverage checklist (nothing left unassigned)

- [x] Frontend — pages, components, lib, design system, real-time client state → **Awais**
- [x] Python API routes + app core + config/errors/rate-limit/logging/cli → **Ahmad**
- [x] Python DB models + Alembic migrations + frozen contracts → **Ahmad**
- [x] Platform services (audit/export/ingestion/extraction/email) + metrics → **Ahmad**
- [x] Reasoning engine (fallback/injection/schema) + heavy AI content (orchestration/reporter/sweeps/prompts/copilot) → **Ahmad**
- [x] Deterministic feature endpoints (simplify/compliance/compare/search/negotiate/detector) + taxonomy/rules → **Taha**
- [x] Node backend routes + auth + Drizzle schema + plumbing + Node AI libs → **Ahmad**
- [x] All tests + CI gate + benchmark + smoke/load + quality docs → **Wasif**
- [x] Deployment (Docker/compose/serverless specs) → **Ahmad**
- [x] SLC planning docs / methodology → shared; QA-gate docs → **Wasif**, product/scope → all cite

*Generated 2026-07-09 from a file-by-file repository walk. Every file above was confirmed to exist. Honest gaps are flagged per member so no examiner surprise costs the degree.*

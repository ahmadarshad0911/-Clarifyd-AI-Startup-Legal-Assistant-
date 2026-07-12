# Clarifyd — AI Contract Risk Analyzer for Pre-Seed Founders
### Final-Year Project Thesis & Technical Report

> Decision-support only. Clarifyd does **not** provide legal advice and is not a substitute for licensed counsel.

**Document status:** viva-ready technical thesis, generated from a full source audit of the repository (backend, backend-node, frontend, docs, git history).
**Repository:** `ai-contract-risk-analyzer/` · **GitHub:** ahmadarshad0911/-Clarifyd-AI-Startup-Legal-Assistant-
**Timeline:** first commit 2026-04-20 → 149 commits → last surveyed 2026-06-08.

---

## 1. Abstract

Clarifyd is an AI-assisted contract risk analyzer built for **pre-seed startup founders** — smart, time-poor, legally untrained people deciding, often late at night, whether to sign a SAFE, term sheet, NDA, or vendor MSA. A founder uploads a contract; Clarifyd extracts the text, segments it into clauses, scores each clause for risk and confidence, sweeps the whole document for **loopholes (including dangerous *missing* clauses)** and **ambiguous language**, and explains every finding in plain English with "why this matters for a startup" and suggested safer wording. A conversational assistant — **Clarifyd AI** — answers follow-up questions and drafts documents, while a hard, schema-enforced guardrail keeps every output framed as decision-support and refuses jurisdiction-specific legal opinions.

The system is delivered under an **SLC (Simple, Loveable, Complete)** philosophy rather than a feature-maximising MVP: one workflow — *upload → analyze → review → export* — done completely and safely. The engineering contribution is a **founder-specific reasoning layer** wrapped in production safety controls: a multi-provider LLM fallback chain with a deterministic rules-based backstop, prompt-injection defense, a SHA-256 hash-chained audit log, and confidence-gated human review.

---

## 2. Problem & Motivation

- Founders sign high-stakes contracts without counsel because legal review is slow and expensive at pre-seed stage.
- Generic contract tools are built for legal teams (jargon-heavy, enterprise workflows) — wrong audience.
- Raw LLMs are unsafe for this: they hallucinate, can be prompt-injected by malicious contract text, and will confidently give "legal advice" that creates liability.

**Clarifyd's thesis:** the value is not "an LLM reads your contract" — it is a *disciplined product* around the LLM: founder-framed explanations, confidence thresholds that force human review on risky/uncertain findings, a rules-based fallback so the product still works when the model fails, and an auditable, non-advice-safe envelope.

Target user (verbatim from `frontend/PRODUCT.md`): *"Non-lawyer founders… smart but time-poor and legally untrained. Tone: a sharp senior counsel who respects their time."*

---

## 3. Objectives & Scope

### 3.1 SLC framing (Decision D1)
The team deliberately chose **SLC over MVP** (`docs/slc/SLC_ASSUMPTIONS_AND_DECISIONS.md`):
- **Simple** — single primary workflow; PDF + DOCX only; fixed clause taxonomy; no enterprise modules.
- **Loveable** — readable risk summaries, fast status feedback, no dead-end UX, explanations that answer "why this matters".
- **Complete** — the full job finishes in-product: upload → analyze → review → export.

### 3.2 The locked workflow
`upload → analyze → review → export` (extended in the UI to `→ draft` via Clarifyd AI).

### 3.3 Two PRDs, on purpose
- **Root `PRD_AI_Contract_Risk_Analyzer.md`** — aspirational "Extended/Production v1.0" (enterprise, §4.1–§4.12).
- **`docs/slc/` pack** — the constrained v0.1 actually built. **When they conflict, `docs/slc/` wins.**
This split is itself a defensible methodology point: scope was explicitly bounded to what a two-person team could finish in two weeks with weekly gates.

### 3.4 Explicitly out of scope (scope locks, `SLC_SCOPE_BOUNDARIES.md`)
SSO/SAML, multi-region, SOC 2 / HIPAA / ISO 27001 certification, marketplace integrations, multi-language, automated legal approvals, billing automation, complex workflow engines, and — importantly — **custom model training / fine-tuning** (Decision D8: use provider APIs, no training in this repo).

---

## 4. System Architecture

Clarifyd is a **three-tier system** with, notably, **two coexisting backends** (a documented, deliberate situation):

```
                          ┌─────────────────────────────────────────┐
                          │   FRONTEND  (Next.js 14 · React 18 · TS) │
                          │   Broadsheet v6 design system · Clerk    │
                          └───────────────┬─────────────────────────┘
                                          │  typed ApiClient (lib/api.ts)
                        /api/* proxy       │  Clerk JWT per request
                                          ▼
        ┌──────────────────────────────────────────┐   ┌───────────────────────────────┐
        │  BACKEND (Python · FastAPI · SQLAlchemy)  │   │  BACKEND-NODE (Next.js 16 ·   │
        │  ★ ACTIVE / DEPLOYED PATH                 │   │  Drizzle · Auth.js · Inngest) │
        │  analyze pipeline · reasoning · reviews · │   │  ○ EXPERIMENTAL / UNMERGED    │
        │  exports · admin · audit hash chain       │   │  broader feature scaffold     │
        └───────────────┬───────────────────────────┘   └───────────────────────────────┘
                        │  httpx (OpenAI-compatible)
                        ▼
             Llama via NVIDIA NIM  (integrate.api.nvidia.com/v1)
             fallback → fallback Llama (nemotron-49b) → deterministic rules
```

### 4.1 Frontend (`frontend/`)
Next.js App Router, React 18, TypeScript. Auth by **Clerk** (JWT minted fresh per request — Clerk tokens expire ~60 s). A **route-aware provider boundary** (`components/conditional-providers.tsx`) keeps ClerkJS (~220 KB) off public marketing pages by rendering them under a Clerk-free stub. `/api/*` is proxied to the backend origin with a 300 s timeout (a cold LLM analysis can take ~120 s). Design system is **"The Broadsheet v6"** — brutalist editorial, warm ivory paper `#f4ede1`, coffee-black ink, single arterial red `#b8260f`, Geist + Geist Mono, sharp edges, no gradients/glass. Motion via Framer Motion; icons Phosphor.

### 4.2 Backend — Python / FastAPI (`backend/`) — the active path
Strict layering, services instantiated once at module scope, LLM services lazily rebuilt per request (a workaround for serverless not firing `lifespan()`). Unified error envelope `{error:{code,message,details,request_id}}`, request-ID middleware, security headers, CORS pinned to production origins, prod-only disabling of `/docs`, and a global `asyncio.Semaphore(4)` that fast-sheds 429s under load. **15 SQLAlchemy tables**, Alembic migrations, SQLite default / Neon-Postgres in production. LLM provider is **Llama via NVIDIA NIM** via raw `httpx` (OpenAI-compatible).

### 4.3 Backend-Node (`backend-node/`) — experimental sibling
A **standalone Next.js 16 API-only backend** built for the Vercel/Drizzle path. It is **broader** than the Python backend (RAG over pgvector, deadline monitoring, lawyer directory + HMAC handoff, OAuth integrations, weekly digest emails, Inngest background jobs, AES-256-GCM token vault) but is **undeployed and unmerged** — a handoff-ready scaffold with a few explicit stubs. For the viva: describe it as the *forward-looking architecture*, not the shipped product.

---

## 5. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind 3, Framer Motion, Phosphor icons, Geist fonts, Clerk auth, GA4, jsPDF |
| Python backend | FastAPI 0.115, Pydantic 2, SQLAlchemy 2 (async) + Alembic, Uvicorn, httpx, tenacity, PyJWT, passlib/bcrypt, pypdf, reportlab (optional PDF) |
| LLM | Llama via NVIDIA NIM (`integrate.api.nvidia.com/v1`), OpenAI-compatible, called via raw httpx (no vendor SDK) |
| Node backend | Next.js 16, Drizzle ORM, @vercel/postgres (Neon) + pgvector, Auth.js v5 (Resend magic-link), Inngest, Upstash rate-limit, docx/pdf-lib, Resend email, Zod |
| Infra / deploy | Docker, Vercel serverless, DigitalOcean App Platform; Neon Postgres; Clerk as auth source of truth |
| In-house (no external dep) | Prometheus metrics registry, sliding-window rate limiter, SHA-256 hash-chained audit log, prompt-injection heuristic, SSRF guard |

---

## 6. The Analysis Pipeline (end to end)

Entry: `POST /analyze/contract` → `_analyze_and_persist()`.

1. **Upload validation** — filename canonicalization, extension allowlist (`.pdf`, `.docx`), **magic-byte sniffing** (`%PDF-`, `PK\x03\x04`), size ≤ 25 MB, SHA-256 hash (also used for dedupe). Content-Length pre-check → 413.
2. **Text extraction** — PDF via `pypdf`; DOCX via stdlib `zipfile` + regex over `word/document.xml`; TXT passthrough. Empty text → 422.
3. **Contract gate** — `ContractDetector`: heuristic first (contract-term density, negative markers, length); ambiguous cases get one fast LLM call; non-contracts rejected with `not_a_contract` (422). Stops users wasting analysis on non-contracts.
4. **Clause tagging** — sentence split, fuse category headings, merge same-category/continuation sentences, drop <5-word fragments. Classification is a **keyword-lexicon** over 10 clause types (confidence 0.9 matched / 0.5 uncategorized) — deterministic, not ML.
5. **Per-clause risk scoring** — `AsyncContractAnalysisService`: parallel LLM calls (concurrency **8**), each returning `{severity, risk_score 1–10, confidence 0–1, rationale}`, **cached** in `ClauseCache` keyed `(provider, model, sha256(prompt_version + text))`. Deterministic rules fallback scores by trigger phrases ("unlimited liability" → critical/10) and clause category.
6. **Whole-contract enrichment (parallel)** — three concurrent LLM sweeps with a 20 s await budget:
   - `ContractReporter` — a "senior attorney" full report (cancelled early if rules find nothing high/critical);
   - `LoopholeSweeper` — present **and absent-clause** loopholes + a must-have-clause checklist;
   - `AmbiguitySweeper` — vague/undefined terms, each with a remediation suggestion.
7. **Findings assembly** — ranked critical → low; only low-severity boilerplate (score ≤ 2) dropped; internal 1–10 score ×10 → 1–100 API scale.
8. **Persistence & review routing** — write `ContractDraft` + `ClauseFinding` rows; **auto-route to the review queue** when `risk_level ∈ {high, critical}` **OR** `confidence < 0.7` **OR** `injection_suspected`; append a hash-chained audit event; cache the full response to `draft.analysis_json`.

**Performance work (git history):** batched clause scoring, per-clause concurrency raised to 8, `max_tokens` tuning, findings-first response (return clauses fast, enrich asynchronously), retry-with-backoff on transient LLM 429/network failures, cold-analysis latency brought under ~20 s.

---

## 7. Reasoning Engine — "Clarifyd AI" (PRD §4.12) — *the novel contribution*

This is the layer that turns a generic analyzer into a **founder-specific** one, and it is where to anchor the viva's "what's novel" story.

### 7.1 Provider chain (graceful degradation)
`FallbackChainProvider([ KimiProvider(primary), KimiProvider(fallback-model), RulesBasedProvider ])`. (`KimiProvider` is the historical class name for an OpenAI-compatible client; the live models are **Llama-3.1-70B primary and nemotron-49B fallback, served through NVIDIA NIM** — swapped in config-only when Kimi K2 was retired.) If no API key is present, the chain is rules-only — **the product never hard-fails on model outage.** Each provider validates output against a JSON schema (Pydantic) with tenacity exponential-backoff retry on `{408,409,425,429,500,502,503,504}` and schema violations; on exhaustion it falls through to the next provider. A shared **token-bucket rate limiter** (`AsyncRateLimiter`, `reasoning_max_rpm`) paces all concurrent per-clause calls so provider RPM throttling **slows** analysis instead of dropping findings.

### 7.2 Founder guidance
Per finding: plain-English explanation, "why it matters for a startup", suggested safer language, negotiation points/red lines, and market-standard references (NVCA / YC SAFE / SaaS MSA norms), conditioned on the founder's `startup_profile` (stage, jurisdiction hint, sector).

### 7.3 Safety controls (all schema-enforced)
- **Non-legal-advice invariant:** every reasoning/compliance/simplify/negotiate response hard-codes `not_legal_advice: Literal[True]` + a canonical disclaimer string — impossible to strip without failing schema validation.
- **Jurisdiction refusal:** the guidance endpoint detects jurisdiction-specific / definitive-opinion questions via regex triggers and returns a "consult licensed counsel" CTA instead of an opinion.
- **Prompt-injection defense** (`injection.py`): contract text is fenced as untrusted `<clause>` data, the system prompt is told to ignore embedded directives, closing tags are neutralized, and a regex precheck sets `injection_suspected` — which force-routes the finding to human review.
- **Deterministic ranking invariant:** findings ordered `(risk_level desc, risk_score desc, confidence desc)` — asserted in tests.

### 7.4 Reasoning HTTP API
`GET /categories`, `POST /evaluate` (ranked findings + founder guidance), `POST /guidance` (Q&A with refusal), `GET /jobs/{job_id}`. **Honest caveat for the viva:** in the shipped Python routes, the founder-guidance text in `/evaluate` and the `/guidance` answers are currently **deterministic scaffolds**, and `/jobs` is an in-memory stub — the *live LLM path* runs through the analyze pipeline and the copilot advisor, not these two routes.

### 7.5 Observability
Prometheus counters: `clarifyd_reasoning_calls_total`, `clarifyd_reasoning_tokens_total{provider,model}`, `clarifyd_reasoning_cost_usd_total`, `clarifyd_reasoning_latency_seconds`, plus `clarifyd_clause_extraction_seconds`.

---

## 8. Feature Catalog (honest status)

| Feature | Route(s) | Backend | Status |
|---|---|---|---|
| Upload → analyze | `/dashboard` | Python pipeline | **Live, fully wired** |
| Findings viewer (health gauge, per-clause diff, accept/reject) | `/findings` | ✓ | **Live** |
| Clarifyd AI (chat + doc drafting, streaming) | `/copilot` | `copilot_advisor` (LLM) | **Live (token streaming)** |
| Reasoning view (§4.12) | `/reasoning` | reasoning routes | **Live UI; guidance text is scaffolded** |
| Negotiation | `/negotiation` (lab), `/negotiate` (redline + jsPDF) | ✓ | **Live (two implementations; nav → /negotiation)** |
| Loophole sweep + must-have checklist | in findings | LLM | **Live** |
| Ambiguity sweep + fix suggestions | in findings | LLM | **Live** |
| Simplify (§4.5) | `/simplify` | regex/rules | **Live but thin** |
| Compare (§4.7) | — | SQL (`compare`) | API only, no page |
| Compliance (§4.4) | — | rules (GDPR/CCPA/HIPAA/FCPA map) | API only, no page |
| Search (§4.9) | `/search` | SQL ilike | **Live but thin** |
| Comments (§4.10) | `/comments` | CRUD | **Live but thin** |
| Reviews / workflow (§4.8) | `/reviews` | queue + role checks | **Live** |
| Exports + audit ledger | `/exports` | JSON always, PDF if reportlab | **Live** |
| Admin console | `/admin` | Clerk roster + stats | **Live, admin-gated** |
| Onboarding (pre-seed profile + terms gate) | `/onboarding/profile` | Clerk metadata | **Live** |
| Feedback / Contact | `/feedback`, `/contact` | DB-backed | **Live** |
| Integrations / webhooks | `/integrations` | stored only, no dispatch | **Mostly stub / waitlist** |
| Lawyer escape-hatch | `/lawyer` | — | **Placeholder ("in development")** |
| Library / templates | `/library` | local data | **Live** |

**Transparency note (raised proactively for the viva):** several polished components exist but are **orphaned** (not wired to any live route): `upload/*`, `findings/findings-list`, `overview-dashboard`, `deadline-monitor`, `lawyer-escape-hatch`, legacy shells, all `admin/*`. Live pages reimplement equivalents inline. This is the main gap between raw component count and wired features — better to volunteer it than be caught by it.

---

## 9. Security & Compliance

- **Non-legal-advice** — schema-enforced on every AI response; UI carries a persistent disclaimer dateline; jurisdiction-specific opinions refused.
- **Human-in-the-loop** — confidence < 0.7, critical severity, or injection-suspected findings are force-routed to a review queue; no silent auto-approval.
- **Audit** — append-only **SHA-256 hash-chained** audit log; `GET /audit/verify` detects tampering; verified by a tamper test (`test_db_models.py`).
- **Prompt-injection** — fencing + defanging + `injection_suspected` flag (dedicated tests).
- **Upload safety** — extension allowlist, magic-byte sniff, size caps, filename traversal guards (14 tests in `test_upload_security.py`).
- **Web fetch** — `/analyze/url` has an SSRF guard; IDOR/ownership checks on drafts and exports (`test_security_audit.py`).
- **Secret hygiene** — gitleaks scan in CI with allowlisted placeholders (PR #6); secrets rotated (DO token, Clerk sk_live, Neon password).
- **Transport / headers** — TLS, HSTS in prod, X-Frame-Options DENY, nosniff, CSP allow-list.
- **Retention** — files 12 months (configurable), soft-delete → delayed hard-delete; right-to-erasure endpoint (`DELETE /auth/account`) purges local DB + Clerk.
- **Account deletion** — `DELETE /admin/users/{id}` (admin console) and `POST /webhooks/clerk` (Svix-verified `user.deleted`, for deletions made from the Clerk dashboard) both call `purge_user_data()`, which removes every row the account owns: drafts (cascading to findings, review actions, queue items, export jobs), letterhead, comments, feedback, contact messages, outbound webhooks, OAuth identities, pending OTP rows (matched **by email**, since they are keyed by address) and the user row. **`audit_event` is deliberately retained** — it is the tamper-evident hash chain above, and deleting links would break `/audit/verify`; it stores an actor id and an action, never document content. Defensible position for the viva: erasure of personal content, retention of an integrity ledger.
- **Privacy** — the browser never persists raw contract text (`lib/analyses.ts` strips `extracted_text`).
- **Deferred (out of scope, stated honestly):** SOC 2 / HIPAA / ISO 27001 certification, multi-region.

---

## 10. Data Model (Python backend, 15 tables)

`User`, `OAuthIdentity`, `EmailVerification`, `ContractDraft`, `ClauseFinding`, `ReviewQueueItem`, `ReviewAction`, `ExportJob`, `AuditEvent`, `ClauseCache`, `ReportCache`, `Comment`, `Webhook`, `Feedback`, `ContactMessage`.

Core relationships: `User → ContractDraft → ClauseFinding`, with `ReviewQueueItem`/`ReviewAction` for the review workflow, `AuditEvent` as the immutable hash chain, and `ClauseCache`/`ReportCache` for LLM-response caching keyed by content hash.

*(The experimental Node backend adds a broader schema: `user_context`, `scans`, `findings`, `deadlines`, `lawyers`, `lawyer_handoffs`, `integrations`, `scan_embeddings` (pgvector), `regulation_snapshots`, `playbook_clauses`, `weekly_digest_state`.)*

---

## 11. Testing & Quality Assurance

- **~124 test functions across 19 files** in `backend/tests/` (pytest, `asyncio_mode=auto`; benchmarks excluded by default).
- Highlights: analyze-endpoint auth/rejection/persistence (7), upload security (14), reasoning provider incl. injection + retry + fallback (11), reporter guardrails incl. byte-stable pipeline + citation grounding (16), auth/roles/rate-limit (11), all §4.x features (8), reasoning API ranking + disclaimer (6), exports (9), reviews (6), DB models incl. audit-tamper (6), security audit SSRF+IDOR (4).
- Live-quality benchmark harness against the live model (`tests/benchmarks/`, `@benchmark`, `cases.yaml`).
- **CI gate:** `pytest backend/tests` + `npm --prefix frontend run typecheck` (`tsc --noEmit`). Frontend has no unit-test runner (typecheck is the gate) — a stated limitation.

---

## 12. Engineering Process & Methodology

### 12.1 Backend-first, gated, 2-week plan (T1–T10)
From `docs/slc/SLC_2_WEEK_WORK_DIVISION.md`. **Owner A** = backend / AI / API / reliability; **Owner B** = final-stage frontend / QA / docs.

| ID | Task | Owner |
|---|---|---|
| T1 | Freeze API schemas & data contracts | A |
| T2 | Ingestion / extraction / risk service modules | A |
| T3 | Backend infra baseline (env/logging/error policy) | A |
| T4 | Review/approve contracts + finalize frontend checklist | B |
| T5 | Live API endpoints + persistence | A |
| T6 | Review queue backend + role checks | A |
| T7 | Export generation + audit logging | A |
| T8 | Frontend pages + integrate live APIs | B |
| T9 | Review queue + export UI | B |
| T10 | Smoke scripts, acceptance checks, docs sync | B |

**Rule:** backend readiness checkpoint must pass before frontend implementation starts; API schemas frozen at T1 (`API_CONTRACT_VERSION = "2026-05-week1-freeze"`), additive-only changes require sign-off.

### 12.2 Evidence of process (git history — 149 commits)
The commit log is a strong methodology artifact: schema freeze → services → live APIs → frontend integration, then a long, honest tail of reliability and UX fixes. Named milestones to cite:
- **Reasoning quality:** "Kimi reasoning quality lift: rubric calibration + suggestion validator + latency cap + benchmark harness"; "Kimi guardrails: persistence cache + sampling lock + citation grounding + canonical order".
- **Performance:** "Batch clause scoring to cut cold-analysis latency under ~20s"; "Findings-first analysis: return clauses fast, enrich sweeps async".
- **Security:** "Security audit fixes: IDOR, secret hygiene, prod hardening" (PR #6).
- **Serverless robustness:** repeated fixes for event-loop-closed and lifespan-not-firing on Vercel — real distributed-systems debugging.
- **Product decisions:** SLC reframing, Clarifyd AI rebrand (from "Co-Pilot"), per-user storage scoping, onboarding grandfathering.

### 12.3 Deployment
Dockerfile (python:3.11-slim) + Vercel serverless ASGI entry + DigitalOcean App Platform specs. Neon Postgres. Clerk is the auth source of truth; local password auth is dev-only and blocked in production.

---

## 13. Roles & Contributions

Four-member split. Full per-person responsibilities + viva Q&A in **`docs/ROLES_AND_VIVA.md`**.

| Role | Name | Roll No. | Defends in viva |
|---|---|---|---|
| **Frontend Developer** | Awais Khan | 2k22-BSCS-446 | Broadsheet design system, all app pages & flows (§8), Clerk auth bridge + per-user storage, typed API client, review/export UI, onboarding, responsive net |
| **Backend Developer** | Ahmad Arshad | 2k22-BSCS-404 | FastAPI layering, all endpoints, 15-table schema + persistence, review queue + roles, exports, audit hash chain (§9), error envelope, rate limiting, security guards, deployment |
| **ML / AI Engineer** | Taha Khan | 2k21-BSCS-329 | Reasoning engine + safety (§7), analyze pipeline intelligence (§6), provider fallback chain, prompt/rubric design, clause classification, risk scoring, injection defense, benchmark harness |
| **QA Engineer** | Wasif Azeem | 2k22-BSCS-422 | ~124-test suite (§11), CI gate (pytest + typecheck), security-audit tests, audit-tamper test, live LLM benchmark, quality gates |

**Boundary line (backend vs ML):** Ahmad moves the data and guards the endpoints; Taha decides what the AI says. They meet at `app/services/reasoning/`.

---

## 14. Limitations (state these before the examiner finds them)

1. **Clause classification is keyword rules, not ML** — deliberate (Decision D8: no model training). Defensible as cost/latency/determinism trade-off; the *risk scoring* is LLM.
2. **Reasoning `/evaluate` guidance + `/guidance` answers are deterministic scaffolds** in the shipped Python routes; live LLM reasoning runs through the analyze pipeline + copilot.
3. **Orphaned components** — several built UI pieces aren't wired to routes (§8 note).
4. **Two backends** — Node backend is broader but undeployed/unmerged; Python is the live path.
5. **Frontend has no unit tests** — typecheck is the only frontend CI gate.
6. **Some §4.x features are thin or API-only** (compare/compliance have no page; simplify/search/comments are minimal).
7. **Single LLM gateway in production** (NVIDIA NIM); the provider abstraction supports others. The live model is **Llama-3.1-70B**, swapped in config-only from the original Kimi K2 when NVIDIA retired Kimi — demonstrating the abstraction's value in practice.

---

## 15. Future Work

- Promote the Node backend (RAG library Q&A, deadline monitoring, lawyer handoff, integrations) to production and merge the two backends.
- Wire the deterministic reasoning routes to the live LLM guidance path.
- Replace keyword clause tagging with a trained/embedding classifier (pgvector already scaffolded).
- Add frontend unit/E2E tests.
- Build the missing pages for compare and compliance; finish integrations dispatch.
- Pursue deferred compliance certifications for enterprise readiness.

---

## Appendix A — Likely viva questions (quick answers)

**Q: What's novel — isn't this just ChatGPT reading a contract?**
The novelty is the *disciplined product around the model*: founder-framed guidance conditioned on `startup_profile`, a multi-provider fallback chain with a deterministic rules backstop so it never hard-fails, prompt-injection defense, confidence-gated mandatory human review, a tamper-evident hash-chained audit log, and a schema-enforced non-legal-advice envelope. A raw LLM has none of these.

**Q: How do you stop the AI giving illegal/legal advice?**
Schema-level `not_legal_advice: True` + canonical disclaimer on every response (can't be stripped without failing validation); the guidance endpoint refuses jurisdiction-specific questions via regex triggers and returns a "consult counsel" CTA; UI carries a persistent disclaimer.

**Q: What if a contract contains "ignore previous instructions"?**
Contract text is fenced as untrusted `<clause>` data, the system prompt ignores embedded directives, closing tags are neutralized, and a regex precheck sets `injection_suspected`, which force-routes that finding to human review. Covered by tests.

**Q: What happens when the LLM is down or rate-limited?**
Tenacity retries with backoff on transient 4xx/5xx; on exhaustion the fallback chain drops to a second model, then to a deterministic rules-based provider — so analysis still returns.

**Q: How is confidence used?**
Per-clause confidence (0–1) gates review routing: `< 0.7` (or critical severity, or injection-suspected) forces a finding into the review queue. It's a routing threshold, not a learned calibration (stated honestly).

**Q: Why two backends?**
Python/FastAPI is the original, tested, deployed path. The Node/Drizzle backend is a forward-looking Vercel-native rewrite with broader scope (RAG, integrations, jobs) — built and handoff-ready but not yet deployed or merged.

**Q: Why SLC not MVP?**
Deliberate (Decision D1): finish one workflow completely and lovably rather than ship many half-features. Scope was locked to a two-person, two-week, backend-first plan with weekly gates.

**Q: How do you know it works? (evidence)**
~124 backend tests including security (upload, SSRF, IDOR), reasoning (injection, retry, fallback, ranking), reporter guardrails (byte-stable, citation-grounded), and audit-tamper detection; plus a live LLM quality benchmark harness. CI gate = pytest + frontend typecheck.

**Q: Data privacy?**
Contracts private per workspace; browser never stores raw contract text; browser localStorage is namespaced by **Clerk user id** (never email — emails are reusable, so an account recreated on a deleted user's address would otherwise inherit its data); retention 12 months with soft/hard delete; deleting an account — from the admin console or the Clerk dashboard, via the signed `user.deleted` webhook — purges every row it owns, retaining only the tamper-evident `audit_event` chain; audit logs attribute every export.

---

*Generated 2026-07-08 from a full repository audit. Every claim above is grounded in source; honest gaps are flagged rather than hidden — examiners reward candour over polish.*

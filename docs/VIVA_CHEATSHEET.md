# Clarifyd — Viva Cheat-Sheet

> One page you can hold. Full detail in `THESIS.md`; per-person Q&A in `ROLES_AND_VIVA.md`. Thursday viva.

**Team:** Awais Khan (2k22-BSCS-446) Frontend · Ahmad Arshad (2k22-BSCS-404) Backend · Taha Khan (2k21-BSCS-329) ML/AI · Wasif Azeem (2k22-BSCS-422) QA.

---

## 30-second pitch (memorize this)
"Clarifyd is an AI contract risk analyzer for pre-seed founders. Upload a SAFE, NDA, or term sheet; it extracts clauses, scores each for risk and confidence, sweeps the whole document for loopholes and missing protections, and explains everything in plain English with negotiation points — never legal advice. The engineering point isn't 'an LLM reads a contract'; it's the safety-hardened product around it: a fallback chain that never hard-fails, prompt-injection defense, confidence-gated human review, and a tamper-evident audit log."

## The 5 numbers to know
- **~124** backend tests across ~19 files; frontend gate = `tsc --noEmit`.
- **15** SQLAlchemy tables (Python backend), incl. `clause_cache` + `report_cache`.
- **8** parallel per-clause LLM calls, paced by a **token-bucket rate limiter** (`reasoning_max_rpm`).
- **~89%** exact severity vs ground truth (100% within one band, 100% precision on benign contracts).
- **0.7** confidence threshold that forces human review.

## The one-line architecture
Next.js 14 + Clerk frontend → FastAPI backend (active) → **Llama (`meta/llama-3.1-70b-instruct`) via NVIDIA NIM**, OpenAI-compatible, with a rules fallback. A second Next.js/Drizzle backend exists but is unmerged/experimental.

> **Model note (say it):** we originally used Kimi K2; NVIDIA retired it from our account, so we swapped to
> Llama-3.1-70B via NVIDIA NIM — **config-only, zero code change**, because of the provider abstraction. That
> swap-ability *is* the point.

## The pipeline (say it in order)
upload → **validate** (magic-byte, size, SHA) → **extract** (pypdf/docx) → **contract gate** → **clause tag** (keyword rules — incl. `force_majeure` + `entire_agreement`, boilerplate-safe lexicon) → **risk score** (LLM, concurrency 8, **rate-limited**, cached) → **3 parallel sweeps** (report / loopholes+missing-clauses / ambiguity) → **rank & assemble** → **persist + auto-route to review** → **hash-chain audit**.

## The 4 safety controls (the money slide)
1. **Fallback chain** — primary Llama → fallback Llama (nemotron-49b) → deterministic rules. Never hard-fails. Calls paced by a **token-bucket rate limiter** so provider throttling slows analysis instead of dropping findings.
2. **Injection defense** — contract fenced as untrusted `<clause>`; suspects force-routed to review.
3. **Confidence gate** — `<0.7` OR critical OR injection → mandatory human review.
4. **Hash-chained audit** — SHA-256 chain, `GET /audit/verify` detects tampering.
Plus: `not_legal_advice: True` is **schema-enforced** on every AI response.

---

## Own-your-lane (full Q&A in `ROLES_AND_VIVA.md`)

**Awais (Frontend)** — flow upload→findings→copilot→export; Broadsheet design system; Clerk JWT-per-request; per-user storage.
- *Clerk off marketing?* ~220 KB ClerkJS; route-aware stub provider. LCP win.
- *Analysis survives navigation?* global `AnalysisProvider` above the outlet, single-flight, progress pill.
- *Browser privacy?* raw contract text never stored; `lib/analyses.ts` strips `extracted_text`.

**Ahmad (Backend)** — FastAPI layering; 15-table schema; review queue; audit hash chain; security guards.
- *Audit tamper-proof?* SHA-256 chain (`prevHash`+`thisHash`), `/audit/verify` detects breaks.
- *Review routing?* `high/critical` OR `confidence<0.7` OR injection → queue; race-safe conditional UPDATE on claim.
- *Hardest bug?* Vercel skips `lifespan` + httpx bound to closed event loop → lazy per-request rebuild.

**Taha (ML/AI)** — reasoning engine; fallback chain; prompts/rubric; risk scoring; injection defense.
- *Where's the ML / do you train?* No training (D8) — applied LLM: schema-constrained output + rules backstop + rubric. Strength, not gap.
- *Fallback?* tenacity retry on 408/409/425/429/5xx → fallback Llama (nemotron-49b) → deterministic rules. Never returns nothing. Token-bucket rate limiter paces concurrent calls to survive provider RPM limits.
- *Injection?* fence contract as untrusted `<clause>`, neutralize tags, `injection_suspected` → force review.

**Wasif (QA)** — ~124 tests / 19 files; CI = pytest + typecheck; benchmark harness; security tests.
- *Test a fuzzy LLM?* deterministic unit tests (structure/ranking/disclaimer/fallback) in CI + separate live `@benchmark` corpus.
- *Audit tamper test?* mutate a mid-chain event, assert `verify` reports the break.
- *Biggest gap?* frontend has no E2E/unit runner — typecheck only. Own it.

---

## Traps — volunteer these before they're found
- Reasoning `/evaluate` guidance text + `/guidance` answers are **deterministic scaffolds** in shipped Python routes; live LLM reasoning runs through the analyze pipeline + copilot. Don't claim those two routes are LLM-backed.
- Several UI components are **built but orphaned** (not wired to routes). Say "reusable building blocks; live pages reimplement inline."
- **Node backend is undeployed/unmerged.** Call it "forward-looking architecture," not shipped.
- Frontend has **no unit tests** — typecheck is the gate. Own it.
- Clause tagging is **keyword rules, not ML** — deliberate (no model training, Decision D8).

## If asked "what's your contribution to the field / novelty"
The founder-specific, safety-hardened reasoning envelope: `startup_profile`-conditioned guidance + market references (NVCA/YC SAFE), fallback chain, injection defense, confidence-gated review, and tamper-evident audit — wrapped in an SLC-scoped, backend-first, gated 2-week methodology. A raw LLM has none of that discipline.

## If the demo breaks
Fall back to: the test suite (~124 tests), the git history (149 commits telling the schema-freeze → services → integration → hardening story), and this architecture. The rigor is the evidence, not just the live demo.

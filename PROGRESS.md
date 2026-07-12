# Clarifyd — Session Progress Log

> Living state file. Read this FIRST at the start of every new session, then update it before ending.
> Purpose: avoid re-pasting long context prompts. This is the single source of truth for "where things stand."
> Last updated: 2026-07-12

---

## Session 2026-07-12 — recreated-account data leak + full deletion purge

Reported symptom: delete a user from the admin console, sign up again on the same email, and the "new" account
resumed exactly where the old one left off — old drafts, old analyses, the saved co-pilot thread, onboarding
already done.

- **Root cause (PR #20, merged + deployed):** browser `localStorage` was namespaced by **email**, and emails are
  reusable. Nothing was resurrected server-side; the data had never left the browser. Now namespaced by **Clerk
  user id** (never reused). `clearUserStorage()` sweeps every `clarifyd.*` key on logout/account switch,
  replacing a hardcoded 11-key list that never covered the scoped keys holding the actual data. `analyses.ts`
  had been writing a **raw, unscoped** key — every account on a browser shared one analysis cache.
- **The gate made it permanent:** `dark-app-shell.tsx` skipped onboarding when device storage said "onboarded",
  then stamped `onboarded: true` onto the *Clerk account* — promoting a stale browser flag into a permanent
  account-level one. It also read storage before `AuthProvider` re-pointed it (child effects run before parent
  effects). Both fixed.
- **Deletion did not mean deletion (PR #22, merged + deployed):** `admin_delete_user` removed the user row and
  drafts only — letterhead, comments, feedback, contact messages, webhooks, OAuth identities and OTP rows all
  survived. New `services/user_purge.py` covers every table; `audit_event` deliberately retained (hash chain).
- **Clerk-dashboard deletes were silently lost:** no webhook existed. New `POST /webhooks/clerk` (Svix HMAC,
  5-min replay window, fails closed without `CLERK_WEBHOOK_SECRET`). **Live and verified** — unsigned/forged
  requests return 401.
- **Co-Pilot Generate button (PR #22):** was enabled from the first render, so a founder could draft before
  answering anything. Now gated on a `READY_TO_DRAFT` sentinel the backend prompts emit only once every term is
  collected.

**Still open:**
- Accounts recreated *before* the fix carry `unsafeMetadata.onboarded = true` in Clerk (written by the old gate);
  deploying does not undo it, so they still skip onboarding. Test with a fresh email, or clear the flag.
- Rows orphaned by deletions performed *before* the purge shipped are not cleaned up retroactively.
- `chore/do-spec-webhook-secret` — declares `CLERK_WEBHOOK_SECRET` in `.do/backend.yaml` (dashboard was the only
  record). Pushed, not merged.

---

## Session 2026-07-11 — reasoning model swap + docs → as-built

- **LLM swap (config-only):** Kimi K2 retired from the NVIDIA NIM account → primary now
  `meta/llama-3.1-70b-instruct`, fallback `nvidia/llama-3.3-nemotron-super-49b-v1.5`, base
  `integrate.api.nvidia.com/v1`. GLM-5.2 tested but ~110–167 s/call (unusable); reranker/safety-guard models
  ruled out (wrong class). Only `*-instruct` models fit clause scoring.
- **Rate limiter added:** `app/services/reasoning/rate_limiter.py` `AsyncRateLimiter` (token bucket),
  `reasoning_max_rpm` setting, shared across providers via `_build_provider_chain`. Fixes dropped findings on
  long contracts under provider 429s.
- **Prompt v4 (`v4-2026-07-09-merit-based`):** merit-based severity rubric + escalation triggers (uncapped/
  nominal liability, personal guarantee, perpetual/unrelated IP, unilateral rights) + de-escalation guard.
- **Clause splitter fixed:** force-majeure guard + tightened assignment/dispute lexicon → killed the 20-page
  boilerplate over-match (was 47 clauses, 87% junk → 7 clean). Added `force_majeure` + `entire_agreement`
  `ClauseType` categories. All 18 clause/reasoning unit tests pass.
- **Measured (dummy MSA, llama-3.1-70b):** ~89% exact severity, 100% within-1, 100% precision; ~6–7 s/clause.
- **Docs → as-built:** rewrote `docs/ARCHITECTURE.md` (was 100% aspirational — K8s/ES/Celery/GPT-4o fiction)
  and `PROJECT_STRUCTURE.md` from real code; updated `README.md`; added AS-BUILT banners to root PRD,
  `docs/slc/SLC_PRD`, `docs/ROADMAP`, `docs/INSTALLATION`; refreshed viva docs (`THESIS`, `VIVA_CHEATSHEET`,
  `ROLES_AND_VIVA`, `WORK_ASSIGNMENT`) with the Llama/NVIDIA + rate-limiter reality. `docs/ARCHITECTURE.md`
  is now the source of truth.
- **Also:** installed Reticle MCP test framework (frontend dev-dep + user MCP server).

---

## Project snapshot

- **Product:** Clarifyd — AI contract risk analyzer for pre-seed founders. One workflow: upload → analyze → review → export. Reasoning surfaced product-side as **Clarifyd AI**.
- **Repo:** `C:\Users\ahmed\Desktop\Clarifyd Startup Contract Helper\ai-contract-risk-analyzer`
  - `frontend/` — Next.js 14 App Router, React 18, TS, Framer Motion, Radix, Phosphor icons.
  - `backend/` — FastAPI + SQLAlchemy + Alembic (original).
  - `backend-node/` — Next.js 16 API + Drizzle + NextAuth + Inngest + Vercel Blob (Vercel path).
- **GitHub:** ahmadarshad0911/-Clarifyd-AI-Startup-Legal-Assistant-
- **Live design system:** "Broadsheet v6" — brutalist editorial. Warm ivory `#f4ede1`, coffee-black ink, single arterial red `#b8260f`. Geist + Geist Mono. Sharp edges, no gradients/glass/shadows. Tokens in `frontend/app/globals.css` (`--bsd-*`).

## Working rules (persistent)

- **CAVEMAN MODE** active by default (terse). Code/commits/PRs/security → normal prose.
- **Merges:** user merges via PRs personally. Pushing to `main` is BLOCKED. Push feature/design branches, hand user the PR link.
- Installed design skills to use: `impeccable`, `ui-ux-pro-max`, `design-taste-frontend`, `emil-design-eng`.
- Preview-first: build redesigns as `/preview`-style routes; do NOT overwrite live pages until user approves. Register new public preview prefixes in `components/conditional-providers.tsx` (`PUBLIC_PREFIXES`).

## Dev servers

- Frontend: `cd frontend && npm run dev` → http://localhost:3000
- Backend (Python): `cd backend && uv run uvicorn app.main:app --reload` → http://localhost:8000
- As of last check (2026-07-06): both DOWN (need restart).

---

## PRIMARY UNFINISHED TASK

**Full-frontend rebuild** to spec `C:\Users\ahmed\Downloads\DESIGN.md` ("Symbolic.ai" cream editorial).
Build as preview routes on localhost; do not touch live pages until approved.

### Design decision — BLOCKED on user confirmation
DESIGN.md is a **different system** than live Broadsheet v6 AND than last session's dark "Night Desk" landing:

| Aspect | Live (`--bsd-*`) | DESIGN.md target |
|---|---|---|
| Canvas | `#f4ede1` amber | `#fdfcf5` cream |
| Type | Geist sans/mono | **Suisse Works serif** + Open Runde + Geist Mono |
| Edges | sharp 0px | pill buttons, 8px cards, 24px feature cards |
| Primary action | red `#b8260f` | **black `#000000`** |
| Accents | red only | teal `#10756a`=verified, violet `#6938ef`=AI processing, red `#f42c2b`=stamp only |
| Elevation | none | warm khaki shadows `rgba(213,208,184,…)` |

Pending questions to user (asked 2026-07-06, not yet answered):
1. Confirm target = full cream-editorial (vs. keep red CTA / vs. dark toggle reconcile).
2. Rollout sequence = foundation+flagship first (vs. all 22 parallel / vs. one at a time).

### Pages to cover (22)
landing (`/`), login, dashboard, findings, copilot (Clarifyd AI), negotiation, reasoning, lawyer, library, compare, compliance, simplify, exports, admin, pricing, faq, security, contact, terms, changelog, status, onboarding.

### Build status per page
_(none built to new DESIGN.md spec yet)_

| Page | Status | Preview route | Notes |
|------|--------|---------------|-------|
| landing | not started | — | |
| login | not started | — | |
| dashboard | not started | — | |
| findings | not started | — | |
| copilot (Clarifyd AI) | not started | — | prior chat-first redesign exists at `/copilot/preview` (dark) |
| negotiation | not started | — | |
| reasoning | not started | — | |
| lawyer | not started | — | |
| library | not started | — | |
| compare | not started | — | |
| compliance | not started | — | |
| simplify | not started | — | |
| exports | not started | — | |
| admin | not started | — | |
| pricing | not started | — | |
| faq | not started | — | |
| security | not started | — | |
| contact | not started | — | |
| terms | not started | — | |
| changelog | not started | — | |
| status | not started | — | |
| onboarding | not started | — | |

---

## Open branches (pushed, NOT merged — need review/merge/deploy)

- `design/clarifyd-ai-preview` → `/copilot/preview` — chat-first command-bar redesign of Clarifyd AI (popup chat, Ask/Draft toggle). Its readiness-gated Generate idea has since **shipped to the real `/copilot`** (PR #22): the backend prompts emit a `READY_TO_DRAFT` sentinel and the button stays disabled until every term is collected. Only the chat-first *layout* is still unmerged here.
- `design/landing-preview` → `/landing-preview` — dark "Night Desk" landing + animated dark/light theme toggle (View Transitions sweep). Edited `components/conditional-providers.tsx` (added `/landing-preview` to PUBLIC_PREFIXES). **← currently checked out.**
- `feat/ambiguity-suggestions` — ambiguity fix suggestions + "add to doc".
- `feat/findings-first-enrichment` — fast findings response + `/analyze/{id}/enrich` endpoint + loophole must-have checklist.
- `chore/rename-copilot-to-clarifyd-ai` — renamed "Co-Pilot" → "Clarifyd AI" everywhere.

Already merged: batched clause analysis, GA+favicon, copilot context/persistence, onboarding grandfather fix.

Also present: `frontend/PRODUCT.md` (impeccable project context).

---

## Other pending items

- **claude-mem:** installed this session via `/plugin marketplace add thedotmack/claude-mem` + `/plugin install claude-mem`.
- **Secrets:** DO token, Clerk `sk_live`, Neon password rotated earlier. Local `frontend/.env.local` still holds a `sk_test` + old values (git-ignored, fine).

---

## How to use this file

1. **Session start:** read this file top-to-bottom to reload context.
2. **During work:** update the per-page status table and branch list as things change.
3. **Session end:** bump "Last updated", record what was done, note the next action.

### Session history

- **2026-07-06:** Read DESIGN.md, mapped current frontend (22 route dirs), documented the cream-vs-brutalist system gap. Created this file. Asked user to confirm design direction + rollout sequence — awaiting answer. No pages built yet.
- **2026-07-09 (later):** Reassigned by hardness per user: Ahmad=★hardest (reasoning core+heavy AI+backend), Awais=★★2nd (frontend+realtime client/auth), Taha+Wasif=lightest (Taha=deterministic feature endpoints, Wasif=QA/verification). Node AI libs moved to Ahmad. Rewrote `docs/ROLES_AND_VIVA.md` as comprehensive per-member viva Q&A matched to FINAL split: §0 shared (8 Q every member), Ahmad (16 Q), Awais (12 Q), Taha (10 Q), Wasif (10 Q), cross-exam boundary probes, rapid-fire facts. All 3 docs now consistent (WORK_ASSIGNMENT wins on file-level). Honest traps flagged per member. Taha's story = "deterministic rules, no trained model"; must not claim training.
- **2026-07-09:** Viva tomorrow. User asked for exhaustive, assumption-free file-by-file work split (said "do not use predefined roles" → re-derived from actual code). Enumerated whole repo exactly: backend 18 routes/14 services+8 reasoning/16 DB models/124 tests across 20 files; node 33 routes/19 libs; frontend 33 pages/43 components/11 libs. Wrote `docs/WORK_ASSIGNMENT.md` — every file mapped to one of 4 owners with coverage checklist + honest traps. Domains (derived, not preset): Awais=Client App, Ahmad=Server & Data Platform (both backends' plumbing), Taha=AI/Reasoning Engine (Python analysis+reasoning + Node AI libs), Wasif=Quality/Testing/Release. Shared boundary = `backend/app/services/` (Ahmad platform svcs vs Taha intelligence svcs). This file supersedes ROLES_AND_VIVA.md role split at file level.
- **2026-07-08:** Viva prep (Thursday). Ran full 5-way repo audit (Python backend, frontend, backend-node, docs, git history — 149 commits). Wrote `docs/THESIS.md` (full technical thesis) and `docs/VIVA_CHEATSHEET.md` (one-pager). Then user gave 4 real team roles: **Awais Khan (2k22-BSCS-446) Frontend, Ahmad Arshad (2k22-BSCS-404) Backend, Taha Khan (2k21-BSCS-329) ML/AI, Wasif Azeem (2k22-BSCS-422) QA.** Wrote `docs/ROLES_AND_VIVA.md` (per-person scope + 8-10 viva Q&A each, honest traps) and backfilled real names into THESIS §13 + cheat-sheet. Key honest framing: no trained ML model (D8) → Taha owns applied-LLM/reasoning + "why no training" defense. Design rebuild still paused pending 2 answers. Also installed ponytail plugin (code-minimalism, ships hooks) via /plugin.

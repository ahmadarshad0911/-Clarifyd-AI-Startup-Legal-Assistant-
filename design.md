# Clarifyd — Design Document

## 1. Overview

**Clarifyd / AI Contract Risk Analyzer** is an SLC (Simple, Loveable, Complete) web application that lets startup founders upload a contract, get clause-level risk analysis (rules + LLM), route findings to reviewers, and export tamper-evident reports. Reasoning runs against external provider APIs (OpenAI / Kimi); there is no in-house model training.

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, plain CSS with a glassmorphism aesthetic.
- **Backend:** FastAPI (Python 3.11+), strict layering (`routes → services → contracts → models`), Pydantic schemas, SQLite (dev) via Alembic.
- **Deployment:** `docker-compose` two-service scaffold (`frontend`, `backend`).

The canonical workflow is: **Upload → Analyze → Review → Export**.

---

## 2. System Architecture

### 2.1 High-level diagram

```
┌─────────────────────┐         ┌────────────────────────────┐
│  Next.js Frontend   │  HTTPS  │      FastAPI Backend        │
│  (App Router, TSX)  │ ──────▶ │  routes / services / dto    │
│  Glass UI shell     │ ◀────── │  AppError envelope          │
└─────────┬───────────┘         └──────────┬─────────────────┘
          │                                 │
          │                                 ▼
          │                       ┌────────────────────┐
          │                       │ Reasoning Provider │
          │                       │  OpenAI / Kimi /   │
          │                       │  Rules / Fallback  │
          │                       └────────────────────┘
          │                                 │
          ▼                                 ▼
   Browser storage              SQLite + Alembic + audit log
   (auth/session, toasts)       exports/ (signed artifacts)
```

### 2.2 Backend layers (`backend/app/`)

| Layer | Responsibility |
|---|---|
| `main.py` | App bootstrap, middleware (request-id, timing), exception handlers, route registration. Services instantiated once at module scope. |
| `config.py` | `Settings` via `pydantic-settings`, cached `get_settings()`. Sole source of env truth. |
| `contracts/` | Frozen Pydantic API schemas + internal data contracts. Frontend-backend boundary. |
| `services/` | Pure business logic (ingestion, text extraction, analysis, reasoning). No FastAPI imports. |
| `services/reasoning/` | `ReasoningProvider` ABC + `OpenAIProvider`, `KimiProvider`, `RulesBasedProvider`, `FallbackChainProvider`. |
| `models/` | Domain dataclasses; SQLAlchemy persistence layer joins in T5. |
| `errors.py` | `AppError` / `ErrorCode` → unified `{error: {code, message, details, request_id}}` envelope. |
| `observability/` | Prometheus counters: `clarifyd_reasoning_calls_total`, `_tokens_total`, `_cost_usd_total`, `_latency_seconds`. |

### 2.3 Request lifecycle

1. `request_context_middleware` assigns/propagates `X-Request-ID`, times the request.
2. Route handler validates input → delegates to a service → maps service result to `contracts/api.py` response.
3. Errors:
   - `AppError` → structured JSON via `handle_app_error`.
   - `RequestValidationError` → 422 envelope.
   - Anything else → 500 via `handle_unexpected_error` (logs with `exc_info`, never leaks internals).

### 2.4 Frontend structure (`frontend/`)

| Path | Purpose |
|---|---|
| `app/page.tsx` | Home: `AppShell` → `UploadCard` → `ProcessingStatus` → `FindingsList`. |
| `app/upload/`, `reviews/`, `reasoning/`, `exports/`, `compare/`, `simplify/`, `negotiate/`, `compliance/`, `comments/`, `search/`, `admin/`, `login/` | Route segments per workflow surface. |
| `components/shell/` | `AppShell`, side-nav, status strip. |
| `components/upload/` | Drop zone, progress, processing status. |
| `components/findings/` | Finding rows, confidence ring, filter bar. |
| `components/reviews/` | Reviewer queue, resolution actions. |
| `components/exports/` | Export status, signed-artifact CTA. |
| `components/disclaimer/` | `not_legal_advice` banner (mandatory on every reasoning surface). |
| `components/common/` | Toasts, modals, pills, audit badges. |
| `lib/` | `auth`, `toast`, `contracts` (TS mirror of backend response schemas). |

### 2.5 Reasoning API (PRD §4.12)

First-class HTTP surface — extend the existing provider modules, do **not** clone provider logic elsewhere.

| Endpoint | Role | Purpose |
|---|---|---|
| `POST /api/v1/reasoning/evaluate` | viewer+ | Submit `draft_id` (or text) → ranked findings + founder guidance. |
| `POST /api/v1/reasoning/guidance` | viewer+ | Follow-up legal-guidance question scoped to draft/finding. |
| `GET /api/v1/reasoning/categories` | public | Supported clause taxonomy. |
| `GET /api/v1/reasoning/jobs/{job_id}` | viewer+ | Poll long-running evaluation. |

**Invariants**
- Findings ordered by `(risk_level desc, risk_score desc, confidence desc)`. Asserted in `tests/unit/test_reasoning_ranking.py`.
- Every reasoning response carries `not_legal_advice: true` + canonical disclaimer.
- `/reasoning/guidance` refuses jurisdiction-specific legal opinions → "consult licensed counsel" CTA.
- Per-clause cache key: `(provider, model, sha256(clause_text))`. One cache only.
- Each call emits `append_audit_event(action="reasoning.evaluate", ...)` so the hash chain captures spend + actor.

---

## 3. Data Contracts

- `contracts/api.py` was **frozen at T1**. Changes are additive-only with default `None` and require Group Mate B sign-off.
- Founder-guidance text lives on `clause_finding.payload_json`; promote to a sibling `guidance_json` column only when querying by guidance attribute becomes a need.
- Confidence thresholds and review-routing rules come from `SLC_ASSUMPTIONS_AND_DECISIONS.md` — never invented in code.

---

## 4. Current UI Design

### 4.1 Visual language

- **Aesthetic:** soft glassmorphism over an animated multi-radial pastel gradient (`#c7d2fe`, `#fbcfe8`, `#a5f3fc`, `#ddd6fe`) — `bg-drift` keyframes drift the background slowly.
- **Glass surfaces:** `backdrop-filter: blur(18px) saturate(140%)` with `rgba(255,255,255,0.55)` fill; opaque fallback for browsers without `backdrop-filter`.
- **Radii:** `12 / 18 / 24 px` scale (`--radius-md/lg/xl`).
- **Shadow:** single elevation token `0 12px 36px rgba(15,23,42,0.10)`.
- **Type:** Inter / Segoe UI system stack; `h1 = 1.6rem`, body `1.5` line-height, tight `-0.01em` letter-spacing on headings.

### 4.2 Color tokens

| Token | Value | Role |
|---|---|---|
| `--color-text` | `#0f172a` | Primary text |
| `--color-muted` | `#475569` | Secondary text |
| `--color-accent` / `--color-accent-2` | `#4f46e5` / `#7c3aed` | Indigo→violet gradient (CTA, focus ring) |
| `--color-success` | `#059669` | OK badges, audit-ok |
| `--color-warn` / `--color-high` | `#ea580c` | High-risk pill |
| `--color-danger` / `--color-critical` | `#dc2626` | Critical risk, errors |
| `--color-low` / `--color-medium` | `#475569` / `#2563eb` | Risk scale |

### 4.3 Components

- **AppShell:** 256px sticky side-nav + content grid; collapses to single column ≤ 880px.
- **Drop zone:** dashed indigo border, hover scale `1.005`, shimmer progress bar.
- **Pills:** `low/medium/high/critical/success/blue/amber/red/gray` + `pill-pulse` for live status.
- **Finding row:** glass card with quoted clause as left-bordered italic blockquote; `.finding-row.injection` adds a red ring for prompt-injection flags.
- **Confidence ring:** SVG ring with embedded 10px Inter label.
- **Toasts:** top-right stack, slide-in, `error/success/info` variants distinguished by 4px left border.
- **Disclaimer banner:** amber `not_legal_advice` band (`#78350f` on `rgba(254,243,199,0.7)`) — must remain visible on every reasoning surface.
- **Audit badge:** `ok / bad / unknown` pill states for the tamper-evident export trail.

---

## 5. Suggested UI/UX Improvements

The current UI is coherent and on-brand, but the following changes would harden the experience for a real founder workflow and lift it above a generic "glassy SaaS demo" look. Grouped by priority.

### 5.1 High priority — usability & trust

1. **Promote the disclaimer to a persistent, dismiss-with-memory banner.** Right now it lives inside content. Make it a sticky strip directly under the top bar on every reasoning/findings/export route, with a "Why this matters" link to a short modal. Founders ignore disclaimers they only see once.
2. **Risk-level color is doing too much work alone.** `pill-low/medium/high/critical` rely almost entirely on hue. Add a shape/icon token per level (▪ low, ◆ medium, ▲ high, ⬣ critical) and a small numeric score so the severity reads correctly for colorblind users and in dark mode.
3. **Findings list needs a 3-pane layout, not a vertical scroll.** Left: filter rail (risk, category, status, reviewer). Center: finding rows. Right: a sticky **clause inspector** showing the original document context around the highlighted clause. Today users have to mentally reconstruct where a clause came from in the source contract.
4. **Inline source-text highlighting.** Add a "View in document" toggle that renders the uploaded contract with the offending clause highlighted using the same risk hue. This is the single biggest trust multiplier for a contract review tool.
5. **Real progress states, not just shimmer.** Replace the indefinite `.shimmer` bar with a four-step pipeline indicator (Uploaded → Extracted → Tagged → Reasoned) wired to backend events. Users currently can't tell whether a 12-second wait is healthy or hung.
6. **Empty / error / loading states for every list.** `FindingsList`, reviews, exports, audit log — each needs a designed empty state (illustration + first-action CTA), a designed error state (with retry + request_id from the envelope), and a skeleton loader instead of layout shift.
7. **Surface `request_id` in toasts on error.** Backend already returns it; expose a "Copy request ID" button on error toasts so users can quote it in support.

### 5.2 Medium priority — polish & consistency

8. **Add a real dark mode.** `color-scheme: light` is hard-coded; the gradient is light-only. Define a parallel token set (`--surface`, `--surface-glass`, `--text`, `--text-muted`, `--border`) and switch by `prefers-color-scheme` plus a manual toggle in the user card.
9. **Replace ad-hoc CSS with a token-driven utility layer.** Either adopt Tailwind (low risk, matches Next.js 14 ergonomics) or formalize the existing custom-property scale into a small SCSS module. The current `globals.css` is already > 350 lines and will rot fast as new routes are added.
10. **Type scale is too compressed.** `h1` at `1.6rem` and `h2` at `1.15rem` are close enough that hierarchy gets lost in long findings views. Move to a modular scale (1.25 ratio): `h1 2rem, h2 1.5rem, h3 1.25rem, body 1rem, small 0.875rem`.
11. **Side-nav needs route grouping.** Twelve top-level segments (`upload`, `reviews`, `reasoning`, `exports`, `compare`, `simplify`, `negotiate`, `compliance`, `comments`, `search`, `admin`, `login`) is too flat. Group into **Analyze / Review / Export / Tools / Admin**, with collapsible sections and an active-route breadcrumb in the content strip.
12. **Animation budget.** `bg-drift` (24s loop), `pulse`, `shimmer`, `slide-in`, and hover translates all run by default. Respect `prefers-reduced-motion` and disable all decorative animations behind that media query.
13. **Drop zone needs paste + URL.** Allow `Ctrl+V` of a PDF/DOCX from clipboard and accept a Google Drive / SharePoint link. Drag-only is a friction point for legal users on managed laptops.
14. **Persistent recent-drafts panel.** The `recent-list` styling already exists in `globals.css` but is not wired into the home shell. Surface the last 5 drafts in the side-nav under "Recent" with status pills.

### 5.3 Lower priority — depth & delight

15. **Findings diff view for re-uploads.** When the same contract is re-uploaded (by hash), show a delta view: resolved, new, unchanged. This is the "loveable" hook for a startup helper.
16. **Reviewer mentions and threads on finding rows.** Comments segment already exists as a route — pull it inline into the finding inspector instead of a separate page.
17. **Keyboard navigation.** `j/k` to move between findings, `r` to resolve, `e` to export, `?` for a cheat sheet. `globals.css` already defines a `.kbd` class — use it.
18. **Export step needs a preview, not just a status pill.** Show a thumbnail of page 1 of the signed PDF + the audit hash so users can verify before downloading.
19. **Tighten the gradient.** Four overlapping radial gradients on a 24s animation is heavy on low-end laptops. Drop to two radials + a static linear, and gate the animation behind `prefers-reduced-motion: no-preference` AND viewport ≥ 1024px.
20. **Branding distinctness.** The conic-gradient brand mark is generic. Commission (or generate) a wordmark + lockup; lock it into the side-nav and the export PDF header so signed reports carry the brand.

### 5.4 Accessibility checklist (must-do, not optional)

- All interactive elements: visible focus ring (already partly done via `box-shadow: 0 0 0 3px rgba(79,70,229,0.18)`) — extend it to `button`, `.nav-item`, `.drop-zone`, `.filter-bar button`.
- Min contrast 4.5:1 for body text on glass surfaces — `--color-muted #475569` on `rgba(255,255,255,0.55)` over a pastel gradient is borderline; verify with axe and bump muted text to `#334155` if it fails.
- All icons paired with text labels or `aria-label`.
- Modal: trap focus, `Esc` closes, restore focus to the trigger.
- Toasts: `role="status"` for info/success, `role="alert"` for errors; auto-dismiss configurable, never under 5s.
- Disclaimer banner: `role="note"`, never collapsed below the fold on first paint.

### 5.5 Suggested next visual milestones

| Milestone | Scope | Effort |
|---|---|---|
| M1 — Tokenization | Move to design tokens (light + dark), modular type scale, motion-reduced variants. | 1 day |
| M2 — Findings 3-pane | Filter rail + inspector + source-text highlight. | 2-3 days |
| M3 — Real progress pipeline | Backend events → 4-step status component. | 1 day |
| M4 — Accessibility pass | Focus rings, ARIA roles, contrast audit, keyboard nav. | 1 day |
| M5 — Brand + export polish | Wordmark, PDF header, audit-verified preview. | 2 days |

---

## 6. Constraints & Non-goals

- **No model training / fine-tuning.** Reasoning is always against an external provider; provider swap is config-only.
- **Backend-first delivery is locked.** Frontend implementation (T8–T10) starts only after the Week-2 backend readiness checkpoint.
- **Schemas in `contracts/api.py` are frozen.** Additive-only changes; requires Group Mate B sign-off.
- **`PROJECT_STRUCTURE.md` is aspirational.** When it conflicts with `docs/slc/`, the SLC docs win.

---

## 7. Onboarding Page Design

> Generated via `ui-ux-pro-max --design-system` for "SaaS legal contract analyzer onboarding professional trustworthy". Pattern: **Funnel (3-Step Conversion)**. Style: **Trust & Authority**. Adapted to coexist with Clarifyd's existing glass + indigo brand surface used on the post-login app shell.

### 7.1 Purpose

First-run experience for a founder landing on Clarifyd. Goals, in order:

1. Establish trust (this tool is built for legal review, not generic AI).
2. Collect the minimum viable **startup profile** (stage, jurisdiction hint, sector) used by `POST /reasoning/guidance` to tailor founder advice.
3. Drive the user to the **first contract upload** — the activation event.

Onboarding is **skippable at every step**. State persists per user; partial profiles allowed (backend treats missing fields as `None`).

### 7.2 Funnel structure

| Step | Section | Goal | Color cue | CTA |
|---|---|---|---|---|
| 0 | Hero | Position the product, surface disclaimer, set expectations | Brand indigo → violet | "Get started" (primary), "I already have an account" (ghost) |
| 1 | Problem | "Founders sign contracts they don't fully understand" — 3 risk illustrations | Warning amber `#B45309` accent | "Show me how Clarifyd helps" |
| 2 | Solution | Animated 4-step pipeline (Upload → Extract → Tag → Reason) with sample finding card | Process blue `#1E40AF` accent | "Set up my profile" |
| 3 | Profile capture | 3 fields: stage, jurisdiction hint, sector | Success green `#059669` accent on completion | "Analyze my first contract" → `/upload` |
| 4 | Activation | First-upload nudge + sample contract link | Brand gradient CTA | "Upload contract" / "Try with a sample" |

Each step shows a step indicator (`Step 2 of 4`) and exposes **Back / Skip / Continue**. Skip from any step jumps straight to step 4 (activation).

### 7.3 Visual system (onboarding-specific tokens)

Onboarding uses a slightly **calmer** palette than the main app — the goal is gravitas, not the playful pastel gradient. Tokens added to `globals.css` under an `[data-route="onboarding"]` scope:

```css
[data-route="onboarding"] {
  --onb-bg: #F8FAFC;
  --onb-surface: #FFFFFF;
  --onb-text: #0F172A;
  --onb-muted: #475569;
  --onb-primary: #1E3A8A;      /* authority navy */
  --onb-primary-2: #1E40AF;
  --onb-accent: #B45309;        /* trust gold for proof badges */
  --onb-step-problem: #DC2626;
  --onb-step-process: #1E40AF;
  --onb-step-solution: #059669;
  --onb-border: #E2E8F0;
  --onb-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  background: var(--onb-bg);
}
```

Brand mark, side-nav and post-login gradient remain unchanged — the navy/gold scope is **onboarding only**, so the move into the main app feels like an unlock.

### 7.4 Typography

- **Headings:** `EB Garamond` 600/700 — legal, formal, trustworthy.
- **Body / UI:** `Lato` 400/700 — high-readability sans, pairs cleanly with EB Garamond.
- **Numerals (step indicator, metrics):** `Lato` 700 with `font-variant-numeric: tabular-nums`.
- **Scale:** `h1 2.5rem / h2 1.75rem / h3 1.25rem / body 1rem / small 0.875rem`. Line-height `1.6` for body.

```css
@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=Lato:wght@300;400;700&display=swap');

[data-route="onboarding"] h1,
[data-route="onboarding"] h2,
[data-route="onboarding"] h3 { font-family: "EB Garamond", Georgia, serif; }
[data-route="onboarding"] { font-family: "Lato", Inter, system-ui, sans-serif; }
```

### 7.5 Layout

Single-column centered funnel, max-width `720px`, generous vertical rhythm. Sticky **top bar** carries the brand mark + step indicator + Skip link. Sticky **bottom bar** on mobile carries Back / Continue so the primary CTA is always reachable with the thumb.

```
┌────────────────────────────────────────────┐
│ [logo] Clarifyd          Step 2 of 4  Skip │  ← sticky top
├────────────────────────────────────────────┤
│                                            │
│           ╭──────────────────╮             │
│           │   Step content   │             │
│           │   (max-w 720)    │             │
│           ╰──────────────────╯             │
│                                            │
│           [ disclaimer note ]              │
│                                            │
├────────────────────────────────────────────┤
│  ◀ Back              Continue ▶            │  ← sticky bottom on mobile
└────────────────────────────────────────────┘
```

Desktop ≥ 1024px: bottom bar inlines under the card. Mobile ≤ 768px: sticky bottom, 16px safe-area padding.

### 7.6 Step-by-step spec

#### Step 0 — Hero

- **Headline (EB Garamond 700, 2.5rem):** "Read every clause before you sign."
- **Sub (Lato 400, 1.125rem, `--onb-muted`):** "Clarifyd flags risky clauses in your contracts in under a minute. Built for founders. Not legal advice."
- **Trust strip:** small SVG row — "SOC 2 in progress", "Tamper-evident exports", "Your documents never train a model". Each item is an outlined badge with a Lucide icon (no emoji).
- **Primary CTA:** `Get started` (navy → indigo gradient, gold focus ring).
- **Secondary:** `I already have an account` → `/login`.
- **Persistent disclaimer note** under the CTAs: "Clarifyd is not a substitute for licensed counsel."

#### Step 1 — Problem (Red accent)

Three short cards, stacked on mobile, 3-up on desktop. Each card:

- Lucide icon (24×24, viewBox `0 0 24 24`, `stroke-width: 1.75`).
- Headline (EB Garamond 600, 1.25rem).
- One sentence (Lato 400, 0.95rem).

Card content:
1. **Liability hidden in cap clauses** — "Standard SaaS contracts often cap your damages but not theirs."
2. **Auto-renew + notice traps** — "60-day notice windows in 12-month evergreen agreements lock you in by default."
3. **IP assignment overreach** — "Some vendor terms assign IP for work you didn't pay them to do."

Mini-CTA at the bottom: `Show me how Clarifyd helps` (ghost button, navy text, gold underline on hover).

#### Step 2 — Solution (Process blue accent)

4-step **animated pipeline** (matches the production progress indicator from §5.1 #5):

```
[ Upload ] ──▶ [ Extract ] ──▶ [ Tag ] ──▶ [ Reason ]
```

- Each node is a 56px circle with the step number in EB Garamond and a Lucide icon below.
- Active node pulses gently (`@keyframes pulse 1.6s infinite`, respects `prefers-reduced-motion`).
- Below the pipeline: a single **sample finding card** rendered with real risk pill styling so the user sees the actual output they will get.

```
┌─ Sample finding ────────────────────────────┐
│ ▲ HIGH    Limitation of Liability           │
│ "Vendor's total liability shall not exceed   │
│  the fees paid in the prior three months." │
│ Confidence ●●●○○ 78%      [ View clause ]   │
└─────────────────────────────────────────────┘
```

CTA: `Set up my profile`.

#### Step 3 — Profile capture (Green accent on success)

Three fields, all optional. Each field has a real `<label for>` (no placeholder-only inputs). Inline help text on focus.

| Field | Control | Values |
|---|---|---|
| Startup stage | Segmented radio | `Pre-seed` · `Seed` · `Series A` · `Series B+` · `Bootstrapped` |
| Jurisdiction hint | Combobox (search) | ISO country list + "Multi-jurisdiction" |
| Sector | Chip multi-select | `SaaS` · `Fintech` · `Healthtech` · `Marketplace` · `Hardware` · `Other` |

Validation: none required. On submit, POST to `/api/v1/users/me/profile` → on success show a green check + "Profile saved" toast (`role="status"`).

CTA: `Analyze my first contract`.

#### Step 4 — Activation

Two-up choice card:

- **Upload your contract** — opens the drop zone modal (paste + URL also supported, per §5.1 #13).
- **Try with a sample** — loads `sample-smoke.docx` (already shipped at repo root) and walks the user through the findings view.

A small footer link: `Skip onboarding for now` → routes to the main `AppShell` home.

### 7.7 Component inventory (additions)

Add to `frontend/components/onboarding/`:

```
onboarding/
├── onboarding-shell.tsx        # data-route="onboarding" wrapper
├── step-indicator.tsx          # "Step N of 4" + dots
├── step-header.tsx             # H1 + sub + accent strip
├── trust-strip.tsx             # SOC2 / tamper-evident / no-training badges
├── problem-cards.tsx           # Step 1 grid
├── pipeline-animation.tsx      # Step 2 SVG/CSS pipeline
├── sample-finding-card.tsx     # static demo finding
├── profile-form.tsx            # Step 3 form
├── activation-choice.tsx       # Step 4 two-up
└── nav-bar.tsx                 # sticky top + sticky bottom (mobile)
```

Routes: add `frontend/app/onboarding/page.tsx` (server component) with client islands for the form and animations.

### 7.8 Interaction & micro-copy rules

- **Step transitions:** 200ms `opacity` + `translateY(8px)` enter; respect `prefers-reduced-motion: reduce` (no transform, opacity only).
- **All clickable elements:** `cursor: pointer`, visible 3px focus ring (`outline: 3px solid #B45309; outline-offset: 2px`).
- **Submit button:** disabled + spinner during async; success → green check for 800ms before route change.
- **Back / Skip:** keyboard `Alt+←` for back, `Esc` to skip.
- **Copy voice:** plain English, second person, max 2 sentences per block. Never "Awesome!" / "Let's go!". Tone is calm-expert.

### 7.9 Accessibility

- All form inputs use `<label for="...">`. No placeholder-only inputs.
- Step indicator is `<nav aria-label="Onboarding progress">` with `aria-current="step"` on the active step.
- Animated pipeline marked `aria-hidden="true"` (decorative) — pipeline state is also conveyed in visible text below.
- Color is never the sole risk signal — the sample finding uses ▲ glyph + "HIGH" label, not just the red pill.
- Body text 16px minimum; muted text uses `#475569` (≥ 4.5:1 on `#F8FAFC`).
- Sticky bars never cover content — content has `padding-bottom: 96px` on mobile.

### 7.10 Anti-patterns to avoid (from design-system search)

- ❌ AI-style purple/pink gradients in the onboarding scope. (Reserve the indigo→violet gradient for the post-login app.)
- ❌ Hidden credentials / fake testimonials. Show only real trust signals.
- ❌ Forced linear flow. Every step must offer Skip.
- ❌ Emoji icons (✅ ⚙️ 🚀). Use Lucide / Heroicons SVG only.
- ❌ Scale-transform hover on buttons (causes layout shift). Use color/shadow transitions.

### 7.11 Backend touchpoints

- `POST /api/v1/users/me/profile` — persists `{stage, jurisdiction_hint, sector[]}`. Field semantics live in `contracts/api.py` as `StartupProfile` (additive schema, defaults `None`). Used by `prompts.py::founder_guidance_prompt(clause, startup_profile)`.
- `GET /api/v1/users/me/onboarding-state` — returns `{completed: bool, last_step: int}`. Frontend resumes mid-flow on re-entry.
- Audit: emit `append_audit_event(action="user.onboarding.completed", ...)` on activation so the hash chain captures the moment the user becomes active.

### 7.12 Pre-delivery checklist (onboarding-specific)

- [ ] No emojis used as icons — all SVG (Lucide).
- [ ] `cursor-pointer` on every interactive surface (cards, badges, chips).
- [ ] Light-mode text contrast verified ≥ 4.5:1 against `#F8FAFC`.
- [ ] Focus ring (gold `#B45309`, 3px) visible on every focusable element.
- [ ] Skip + Back available at every step except activation.
- [ ] All form inputs have associated `<label for>`.
- [ ] `prefers-reduced-motion` disables the pipeline pulse and transitions.
- [ ] Responsive at 375 / 768 / 1024 / 1440px; no horizontal scroll.
- [ ] Sticky bottom bar respects iOS safe-area (`padding-bottom: env(safe-area-inset-bottom)`).
- [ ] Disclaimer note visible on every step (`role="note"`).

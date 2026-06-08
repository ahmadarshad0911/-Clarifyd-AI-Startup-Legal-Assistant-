# Clarifyd — Product

**What it is.** An AI contract risk analyzer for pre-seed startup founders. A founder uploads a contract (SAFE, term sheet, vendor MSA, NDA); Clarifyd extracts the text, scores each clause for risk, sweeps for loopholes (including dangerous *missing* clauses) and ambiguous language, and explains it all in plain English. A conversational assistant ("Clarifyd AI") answers follow-up questions and drafts documents — never giving jurisdiction-specific legal advice.

**Who uses it.** Non-lawyer founders, late at night, on laptop or phone, deciding whether to sign or what to push back on. They are smart but time-poor and legally untrained. Tone: a sharp senior counsel who respects their time. Mandatory: every output carries a "not legal advice, consult counsel" reminder.

**Register.** product — the design SERVES the workflow (upload → analyze → review → export → draft). This is app UI, not a marketing page.

## Design system (existing — preserve it)

"Broadsheet v6" — brutalist editorial, like a financial newspaper.

- **Surface:** warm ivory paper `--bsd-paper`, deeper paper `--bsd-paper-deep`.
- **Ink:** coffee-black `--bsd-ink`; body `--bsd-body`; muted `--bsd-muted`; soft `--bsd-soft`.
- **Accent:** a single arterial red `--bsd-red` — used sparingly for emphasis, active state, the one thing that matters.
- **Lines:** hairline `--bsd-hairline`; hard ink rules. Sharp edges, no rounded cards, **no gradients, no glassmorphism, no shadows-as-decoration**.
- **Type:** Geist (display + body) and Geist Mono (`cf-mono` for labels/eyebrows). Hierarchy via scale + weight, tight display tracking.
- **Existing classes/utilities:** `cf-mono`, `cf-eyebrow`, `bsd-btn`, `bsd-input`, `bsd-field`, `cf-pulse` (pulse animation). Inline styles using the tokens are the norm in this codebase.
- **Motion:** Framer Motion is available; ease-out curves, respect `prefers-reduced-motion`.

Identity preservation wins: build new surfaces inside this system, do not introduce a competing palette or a cream/SaaS look.

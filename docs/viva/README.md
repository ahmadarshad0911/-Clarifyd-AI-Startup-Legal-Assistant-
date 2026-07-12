# Viva & Thesis Deliverables

Everything needed for the final-year project defence, in one folder.

**Institution:** NFC Institute of Engineering & Technology, Multan &middot; Department of Computer Science
**Supervisors:** Mr. Hassan Raza &middot; Ms. Saima Ali
**Team:** Ahmad Arshad (2K22-BSCS-404) &middot; Awais Khan (2K22-BSCS-446) &middot; Taha Khan (2K21-BSCS-329) &middot; Wasif Azeem (2K22-BSCS-422)

## What is here

| File | What it is | How to use it |
|---|---|---|
| `FYP_REPORT.html` | **The thesis.** 8 chapters, 17 figures, 11 tables, 26 test cases, 19 references. | Open in Chrome → **Ctrl+P** → *Save as PDF*. A4 margins and page breaks are already set. |
| `FYP_VIVA_PRESENTATION.pptx` | **The presentation.** 21 slides, editable in PowerPoint. Speaker notes on every slide. | Open in PowerPoint → **Alt+F5** for Presenter View (audience sees the slide, you see the notes). |
| `FYP_VIVA_DECK.html` | The same deck as a browser fallback, in case PowerPoint is unavailable on the day. | Open in any browser. `→` / `←` to navigate, `N` toggles presenter notes. |
| `build_ppt.py` | Regenerates the `.pptx` from scratch. | `python -m pip install python-pptx` then `python build_ppt.py`. |
| `rewrite_notes.py` | Rewrites the speaker notes only, leaving slides untouched. | Run *after* `build_ppt.py`. |
| `nfc-iet-logo.jpg` | The NFC IET crest used on the thesis title page. | Already embedded in the report as a data URI; kept here as the source. |

## The thesis structure

Follows the departmental reference format exactly:

1. **Introduction** &mdash; domain, problem, motivation, terms, workflow, goals, scope, ethics.
2. **Existing System** &mdash; related work, comparison, novelty, use-case diagrams, **20 requirement shells**, 13 non-functional requirements.
3. **Software Process Model** &mdash; gated incremental, and why not Waterfall or pure Scrum. T1&ndash;T10 with gates.
4. **Proposed System** &mdash; features, business context, operating environment.
5. **System Design** &mdash; ER diagram, DFD levels 0/1/2, activity, class, sequence, architecture, plus the fallback chain and audit hash chain.
6. **Development** &mdash; tool selection with justification; four real engineering problems solved.
7. **Software Testing** &mdash; strategy, testing a non-deterministic model, **26 black-box test cases**, white-box, security.
8. **Implementation** &mdash; honest status table, deployment, a privacy-defect case study, limitations, future work.

Every requirement (FR-01 &hellip; FR-20) maps to a test case (TC-01 &hellip; TC-26), so "how do you know that works?" is answerable by pointing at a table row.

## Who presents what

| Member | Slides | Owns and defends |
|---|---|---|
| **Ahmad** &middot; Backend | 1&ndash;5, 11&ndash;14, 18 | Engine, database, review queue, audit hash chain, account deletion, security, deployment |
| **Taha** &middot; AI | 6&ndash;10 | The pipeline, the novelty argument, fallback chain, prompt-injection defence, confidence gate |
| **Awais** &middot; Frontend | 15&ndash;17 | Interface, the per-user storage bug and fix, Clarifyd AI guardrails |
| **Wasif** &middot; QA | 19&ndash;20 | 124-test suite, the audit-tamper test, honest limitations |

**Rule agreed by the team:** never answer for someone else's lane. Hand it over by name.

## Related documents (elsewhere in `docs/`)

- `../THESIS.md` &mdash; the technical thesis in Markdown; source material for `FYP_REPORT.html`.
- `../ROLES_AND_VIVA.md` &mdash; per-member Q&A in plain English.
- `../VIVA_CHEATSHEET.md` &mdash; one page to hold during the defence.
- `../ARCHITECTURE.md` &mdash; the as-built system design (source of truth).

## A note on honesty

Both the report and the deck **state the project's limitations up front** &mdash; no model was trained, clause tagging is a keyword lexicon, the frontend has no unit tests, two features are API-only, the second backend is undeployed, and confidence is a routing threshold rather than a calibrated probability. This is deliberate. An examiner will find these anyway; declaring them first makes every other claim more credible.

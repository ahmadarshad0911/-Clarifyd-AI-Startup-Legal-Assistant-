# SLC Assumptions and Decisions Log

## Working Context
- Delivery model: **2 contributors only** (Group Mate A / Group Mate B)
- Timebox: **2 weeks**
- Product mode: **SLC (Simple, Loveable, Complete)** for v0.1

## Explicit Assumptions

| ID | Assumption | Impact | Validation Plan |
|---|---|---|---|
| A1 | External reasoning APIs (OpenAI/Kimi) remain available | Core analysis depends on it | Add provider fallback + rate-limit strategy |
| A2 | Typical contract quality is parseable from PDF/DOCX | Extraction reliability | Include OCR fallback and parse-failure handling |
| A3 | Users accept decision-support (not legal advice) | Legal risk posture | Add disclaimer and approval workflow controls |
| A4 | Initial user base is small team pilots | Infrastructure sizing | Optimize for single-region initial deployment |
| A5 | Two-person team cannot build all enterprise modules | Scope pressure | Enforce deferred list and weekly gates |

## Decisions (Locked for v0.1)

| ID | Decision | Rationale | Status |
|---|---|---|---|
| D1 | Use SLC instead of MVP framing | Avoid incomplete/broken first release | Approved |
| D2 | Define one complete workflow only | Keeps build small while still usable | Approved |
| D3 | Restrict formats to PDF + DOCX | Faster quality and test coverage | Approved |
| D4 | Keep confidence thresholds explicit | Removes reviewer ambiguity | Approved |
| D5 | Enforce human review for low-confidence and critical clauses | Safety + trust | Approved |
| D6 | Deliver docs-first repo scaffold plan | Align implementation and collaboration | Approved |
| D7 | Keep external integrations deferred | Reduce implementation risk | Approved |
| D8 | Use provider APIs for reasoning (no model training) | Faster delivery and lower operational complexity | Approved |

## Confidence Threshold Policy
- **High confidence:** >= 80
- **Medium confidence:** 60-79
- **Low confidence:** < 60

Rules:
1. Low-confidence findings always enter review queue.
2. Critical-severity findings always require reviewer acknowledgement.
3. Findings below 40 confidence are shown with caution marker.

## Data and Security Defaults
- Retention default: 12 months for uploaded files (configurable later).
- Analysis metadata retained for audit by default.
- Soft-delete followed by delayed hard-delete window.
- All exports are user-attributed in audit logs.

## Open Risks and Handling

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| OCR quality variance | Medium | Medium | Add manual text correction fallback |
| LLM output inconsistency | Medium | High | Structured prompts + schema validation |
| Scope creep from stakeholders | High | High | Use SLC boundary doc as gate |
| Delivery bottleneck with 2 people | Medium | High | Backend-first sequencing + strict ownership |

## Decision Update Rule
If a decision is changed, update:
1. This file,
2. `SLC_SCOPE_BOUNDARIES.md`,
3. `SLC_2_WEEK_WORK_DIVISION.md`.


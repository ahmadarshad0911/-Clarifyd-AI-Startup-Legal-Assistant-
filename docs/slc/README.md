# AI Contract Risk Analyzer — SLC Documentation Pack

## Purpose
This folder is the **canonical v0.1 SLC (Simple, Loveable, Complete)** source of truth for execution.

- **Simple:** narrow scope that can be delivered quickly by 2 people.
- **Loveable:** polished core UX for one end-to-end job.
- **Complete:** fully usable for that job without “placeholder” gaps.

## Document Map

| File | Purpose | Owner |
|---|---|---|
| `SLC_PRD_GAP_AUDIT.md` | What was ambiguous in the old PRD and how it was made explicit | Product |
| `SLC_SCOPE_BOUNDARIES.md` | In-scope, out-of-scope, and anti-scope-creep guardrails | Product + Tech Lead |
| `SLC_ASSUMPTIONS_AND_DECISIONS.md` | Explicit assumptions, decisions, and unresolved risks | Product + Tech Lead |
| `SLC_PRD_AI_Contract_Risk_Analyzer.md` | Canonical SLC PRD for implementation | Product |
| `SLC_2_WEEK_WORK_DIVISION.md` | 2-week phased plan with milestones and ownership split | Project Lead |
| `SLC_WORK_BREAKDOWN_A_B.md` | Task ownership matrix for Group Mate A/B | Project Lead |
| `SLC_T4_FRONTEND_FINAL_STAGE_PLAN.md` | Task 4 output: contract approval record and frontend execution checklist | Project Lead |
| `SLC_GITHUB_SCAFFOLD_PLAN.md` | Target repo scaffold and CI baseline | Tech Lead |
| `SLC_QUALITY_GATES.md` | Definition of done and release gates | QA + Tech Lead |

## Execution Order
1. Read `SLC_PRD_GAP_AUDIT.md`
2. Confirm boundaries in `SLC_SCOPE_BOUNDARIES.md`
3. Build from `SLC_PRD_AI_Contract_Risk_Analyzer.md`
4. Execute `SLC_2_WEEK_WORK_DIVISION.md` and `SLC_WORK_BREAKDOWN_A_B.md`
5. Enforce gates from `SLC_QUALITY_GATES.md`

## Governance Rules
- If a new idea is not in SLC scope, treat it as deferred.
- If wording is ambiguous, update the relevant SLC doc before coding.
- If implementation and docs diverge, docs must be updated in the same PR.


# SLC Work Breakdown — Group Mate A / Group Mate B (2-Week Backend-First)

## Ownership Principles
1. Each task has one direct owner.
2. Cross-team dependencies must be explicit.
3. No “shared ownership” without a named approver.
4. Frontend implementation starts only in the **final stage of Week 2** after backend readiness checkpoint.
5. Reasoning is provider-API based (OpenAI/Kimi); no model training work is in scope.

## Workstream Ownership

| Workstream | Primary Owner | Supporting Owner |
|---|---|---|
| Backend API + data contracts | Group Mate A | Group Mate B |
| Extraction + risk pipeline | Group Mate A | Group Mate B |
| Frontend workflow UX | Group Mate B | Group Mate A |
| Review queue UX and behavior | Group Mate B | Group Mate A |
| Export and report layout | Group Mate A | Group Mate B |
| Test scenarios and acceptance scripts | Group Mate B | Group Mate A |
| Dev environment + CI scaffold | Group Mate A | Group Mate B |
| Documentation accuracy | Group Mate B | Group Mate A |

## Detailed Task Matrix (2-Week Constraint)

| ID | Week | Task | Owner | Depends On | Output |
|---|---|---|---|---|---|
| T1 | 1 | Define/freeze API schemas and internal data contracts | A | - | Approved schema contract |
| T2 | 1 | Implement ingestion/extraction/risk service modules | A | T1 | Service layer modules |
| T3 | 1 | Build backend infra baseline (env/logging/error policy) | A | T1 | Stable backend scaffold |
| T4 | 1 | Review/approve contracts + finalize frontend execution checklist | B | T1 | `SLC_T4_FRONTEND_FINAL_STAGE_PLAN.md` |
| T5 | 2 (early) | Implement live API endpoints + persistence | A | T1,T2,T3 | Live backend APIs |
| T6 | 2 (early) | Implement review queue backend + role checks | A | T5 | Review API behavior |
| T7 | 2 (early) | Implement export generation + audit logging | A | T6 | Export service + audit records |
| T8 | 2 (final stage) | Build frontend pages and integrate live APIs | B | T4,T5,T6,T7 | Live end-to-end UI flow |
| T9 | 2 (final stage) | Build review queue + export UI interactions | B | T8 | Review/export UX |
| T10 | 2 (final stage) | Final smoke scripts, acceptance checks, docs sync | B | T9 | Release-ready UX/docs |

## Parallelization Plan
- Week 1: Backend delivery takes priority; B focuses on contract review/planning artifacts.
- Week 2 early stage: backend tasks (T5-T7) complete before frontend implementation starts.
- Week 2 final stage: B executes frontend tasks (T8-T10) on completed backend APIs.
- Integration sync occurs daily during Week 2.

## Handoff Rules
1. Owner must provide:
   - brief implementation note,
   - known limits,
   - test steps.
2. Receiver confirms integration within 24 hours.
3. Unclear handoffs are blocker-level issues.

## Escalation Path
- If a dependency blocks for > 1 day:
   1. Raise in daily sync.
   2. Re-scope same week using SLC boundaries.
   3. Update week plan and this matrix.


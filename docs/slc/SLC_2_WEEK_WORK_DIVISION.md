# SLC 2-Week Work Division

## Team Model
- **Group Mate A:** Backend, AI pipeline, API, and reliability
- **Group Mate B:** Frontend implementation at final stage, QA scripts, and docs alignment

## Delivery Goal
Ship v0.1 SLC with one complete workflow:
upload -> analyze -> review -> export

## Scheduling Constraint (Locked)
- Total implementation window is exactly **2 weeks**.
- Backend and API implementation run first; frontend build starts only at the **final stage** of Week 2.
- All critical-path work closes by end of Week 2.
- Reasoning uses external provider APIs (OpenAI/Kimi); no model training/fine-tuning in this project.

---

## Week 1 — Backend Foundation + Core Logic + API Contract Freeze

### Outcomes
- Repo/app skeleton is stable and runnable.
- Service-layer ingestion/extraction/risk logic is implemented.
- API request/response schemas are finalized and frozen.
- Backend-first execution is locked; no frontend implementation work starts in Week 1.

### Group Mate A
- Initialize backend service structure, env config, and logging baseline.
- Implement file validation, extraction, clause tagging, and risk scoring modules.
- Define and freeze API schemas for upload, analysis, review, and export metadata.
- Add module tests and failure-path handling for service layer.

### Group Mate B
- Review and approve API contracts and sample payloads.
- Draft frontend task plan based on frozen contract shapes.
- Prepare acceptance checklist and smoke script placeholders.
- Keep docs aligned with backend-first sequencing.

### Exit Criteria
- Service logic passes fixture-based checks.
- API schema contract is approved by both A and B.
- Frontend implementation backlog is finalized for final-stage execution.

---

## Week 2 — Backend Completion, Then Final-Stage Frontend

### Outcomes
- Live API endpoints, review queue backend behavior, export, and audit logging are completed first.
- Frontend implementation starts only after backend readiness checkpoint.
- Frontend integration, review UX, and export UX are completed in the final stage.
- Core audit events, defect fixes, and release handoff are complete.

### Group Mate A
- Implement API endpoints and persistence wiring for upload/analyze/review/export.
- Implement review queue state transitions and role checks.
- Implement export generation and core audit logging.
- Fix critical/high defects and stabilize retries/timeouts.

### Group Mate B
- **Final-stage only (after backend checkpoint):**
- Build frontend shell/pages and wire live API integration.
- Build review queue UI actions, role-aware controls, and decision flow.
- Add export preview/download UX and error messaging states.
- Finalize smoke scripts, acceptance checks, and docs sync.

### Exit Criteria
- Backend readiness checkpoint is passed before frontend implementation starts.
- End-to-end live flow works for sample contracts without manual workaround.
- Critical and low-confidence findings require explicit review action.
- Export includes review decisions and is downloadable from UI.

---

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

## Parallelization Rules
- Week 1: Backend delivery takes priority; B only performs planning/review artifacts.
- Week 2 early stage: backend tasks (T5-T7) complete before frontend implementation starts.
- Week 2 final stage: B executes frontend tasks (T8-T10) in sequence on completed backend APIs.
- If a blocker exceeds 1 day, re-scope within SLC boundaries in the same week.

# SLC Task 4 Deliverable — Contract Approval + Final-Stage Frontend Checklist

## Task Context
- Source task: `T4` in `SLC_2_WEEK_WORK_DIVISION.md`
- Task statement: Review/approve contracts + finalize frontend execution checklist
- Required output: Final-stage frontend plan

## Contract Approval Record (Week 1 Freeze)

### Approval Decision
- **Status:** Approved
- **Approved contract version:** `2026-05-week1-freeze`
- **Frontend implementation rule:** Do not start frontend coding until Week 2 final stage and backend readiness checkpoint is passed.

### Approved Contract Sources
1. `backend/app/contracts/api.py`
2. `backend/app/contracts/analysis.py`
3. `backend/app/contracts/ingestion.py`

### Approved API Shapes

| Flow | Request | Response | Notes |
|---|---|---|---|
| Upload | `UploadContractRequest` | `UploadContractResponse` | `file_name`, `file_size_bytes`, `draft_id`, status |
| Analyze | `AnalyzeContractRequest` | `AnalyzeContractResponse` | Includes `summary` + `findings[]` |
| Review action | `ReviewActionRequest` | `ReviewActionResponse` | Decision lifecycle: accept/request_change/escalate |
| Export | `ExportReportRequest` | `ExportReportResponse` | Supports `pdf`/`json`, export status |

### Validation Rules Confirmed
- All API models are `extra="forbid"` and `frozen=True`.
- Confidence fields are normalized to `0..1`.
- Risk summary score is constrained to `1..10`.
- Enum-based status/decision/risk levels are fixed and documented in contract code.

## Final-Stage Frontend Execution Checklist (Week 2)

## Gate A — Pre-Implementation (must be complete before frontend coding)
1. Backend endpoints for upload/analyze/review/export are implemented and reachable.
2. API responses conform to frozen contract models.
3. Backend error payload includes stable `error.code`, `error.message`, `error.details`, `error.request_id`.
4. Request correlation header (`X-Request-ID`) is available for debugging.

## Gate B — Frontend Build Sequence (Week 2 final stage)
1. Build contract upload page using `UploadContractRequest/Response`.
2. Build analysis results page using `AnalyzeContractResponse`:
   - render findings list,
   - show severity + confidence,
   - show explanation and safer-language fields.
3. Build review decision controls using `ReviewActionRequest/Response`.
4. Build export trigger + result view using `ExportReportRequest/Response`.
5. Add standardized error-state components mapped to backend error payload.

## Gate C — Acceptance Checks
1. Upload -> analyze -> review -> export flow works end-to-end on live APIs.
2. UI handles `critical` and low-confidence findings without silent fallback.
3. Export status and download path are visible and actionable.
4. Frontend logs include request IDs from backend responses for support/debug.
5. Docs and UI labels remain aligned with provider-API reasoning strategy (OpenAI/Kimi, no model training).

## Deferred (Explicitly not in Task 4)
- No frontend implementation code in Week 1.
- No changes to frozen API contract shapes without explicit re-approval.
- No custom model training/fine-tuning workflow.

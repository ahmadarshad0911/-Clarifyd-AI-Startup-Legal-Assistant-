# SLC Quality Gates and Definition of Done

## Objective
Prevent “looks-done” delivery by enforcing minimum functional, UX, and reliability bars for v0.1 SLC.

## Definition of Done (Feature-Level)
A feature is done only if all are true:
1. Behavior matches SLC PRD acceptance criteria.
2. Error states are handled and user-visible.
3. Logging/audit implications are implemented.
4. Documentation is updated in the same change.
5. Owner and reviewer sign-off is recorded.

## Stage Gates

| Gate | Required Evidence | Owner |
|---|---|---|
| G1 Scope Gate | In-scope confirmation from boundaries doc | Product owner |
| G2 Design Gate | API/data contract and UX path reviewed | A/B peer review |
| G3 Build Gate | Implementation complete with baseline tests | Implementer |
| G4 Quality Gate | Test pass, manual scenario pass, no blocker defects | QA owner |
| G5 Release Gate | Release checklist + rollback steps + docs signoff | Tech lead |

## Mandatory Test Coverage (SLC Baseline)
- Upload validation tests (allowed formats, max file size).
- Clause extraction response schema tests.
- Confidence threshold routing tests.
- Review queue state transition tests.
- Export generation tests.
- Critical path UI smoke tests.

## Defect Severity Policy
- **Blocker:** prevents core workflow completion. Must fix before release.
- **High:** incorrect risk result presentation or data integrity issue. Must fix before release.
- **Medium:** workaround exists. Can ship only with explicit issue and owner.
- **Low:** cosmetic/non-blocking. Backlog allowed.

## Release Checklist
1. Core workflow demo passes end-to-end.
2. Known issue list reviewed and accepted.
3. Environment variables and setup docs are accurate.
4. Audit log entries verified for upload/review/export.
5. Rollback and recovery notes documented.

## Non-Negotiable SLC Rules
- No “TODO” placeholders in shipped core flow.
- No hidden manual steps required for normal users.
- No ambiguous messaging on legal responsibility.
- No silent failure paths.


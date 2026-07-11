# Product Requirements Document (SLC v0.1)
## AI Contract Risk Analyzer

**Version:** 0.1 SLC  
**Status:** Approved for build  
**Model:** Simple, Loveable, Complete  
**Team:** Group Mate A + Group Mate B  
**Delivery Window:** 2 weeks
**Execution Constraint:** Backend-first; frontend implementation starts in final stage of Week 2
**Reasoning Strategy:** Use external provider APIs (OpenAI/Kimi); no custom model training

---

> ## ⚠️ AS-BUILT NOTICE
>
> This SLC PRD is the **build spec**; most of it shipped. Two things drifted from the text and are worth
> noting for accuracy:
> - **Model/provider:** the live reasoning model is **Llama (`meta/llama-3.1-70b-instruct`) via NVIDIA NIM**,
>   not Kimi K2 (Kimi was retired from the NVIDIA account). The provider class is still named `KimiProvider`
>   but is just an OpenAI-compatible client. A **token-bucket rate limiter** (`reasoning_max_rpm`) now paces calls.
> - **Auth:** production auth is **Clerk (RS256/JWKS)**; the local email/password path is disabled in prod.
>
> Current architecture of record: [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Product Intent
Deliver one complete, trustworthy workflow for contract risk triage:
1. Upload a contract.
2. Get clause-level risk + confidence + plain-language explanation.
3. Review low-confidence/critical items.
4. Export an actionable risk summary.

This product is **decision-support only** and does not replace legal counsel.

---

## 2. SLC Definition Applied

### 2.1 Simple
- Single primary workflow.
- Limited file types: PDF, DOCX.
- Fixed clause taxonomy in v0.1.
- No advanced enterprise modules.

### 2.2 Loveable
- Clear, readable risk summaries.
- Fast feedback on analysis status.
- No dead-end UX in core path.
- Explanations answer “why this matters.”

### 2.3 Complete
- A user can finish the full task without external tooling:
upload -> analyze -> review -> export.

---

## 3. Target Users

| Persona | Primary Job | Success Condition |
|---|---|---|
| Legal Reviewer | Find risky clauses quickly | Can triage and document decisions |
| Contract Manager | Prepare negotiation notes | Can export clear risk report |
| Founder/Operator | Understand key liabilities | Can interpret results without legal jargon |

---

## 4. Scope (v0.1 SLC)

## In Scope
1. Contract upload and validation.
2. OCR/text extraction where needed.
3. Clause extraction for fixed categories:
   - Liability and limitation
   - Indemnity
   - Payment terms
   - Termination
   - Confidentiality
   - IP ownership
   - Governing law
   - Dispute resolution
   - Data protection
   - Assignment
4. Clause-level risk scoring with severity and confidence.
5. Plain-language explanation and safer-language suggestion.
6. Manual review queue for low-confidence/critical items.
7. Basic role model: Admin, Reviewer, Viewer.
8. Export report (Markdown/PDF).
9. Core audit events.

## Out of Scope
- SSO/SAML
- Benchmark marketplace data
- Custom rule builder UI
- Multi-language support
- Advanced workflow automation
- Live third-party integrations

---

## 5. Functional Requirements

### F1. Upload and Ingestion
- Accept `.pdf` and `.docx`.
- Max file size: 25 MB.
- Max batch size in v0.1: 10 files.
- Reject unsupported files with explicit reason.

**Acceptance Criteria**
- Upload success rate >= 98% for valid files.
- Invalid file errors are user-readable and logged.

### F2. Text Extraction and Clause Segmentation
- Extract text and segment by fixed taxonomy.
- Store source offsets for clause references.
- If extraction confidence is low, mark as “needs review”.

**Acceptance Criteria**
- All extracted clauses include text, clause type, confidence.
- Parse failures are surfaced with retry option.

### F3. Risk Scoring
- Assign severity: Critical, High, Medium, Low, Info.
- Assign confidence score (0-100).
- Include short rationale per finding.

**Acceptance Criteria**
- Every finding includes severity + confidence + rationale.
- Risk outputs pass schema validation.

### F4. Explanation Layer
- Plain-language explanation (50-150 words).
- “Why this matters” and “Suggested safer wording” fields.

**Acceptance Criteria**
- Explanations avoid unexplained legal jargon.
- Suggested wording appears for High/Critical findings.

### F5. Review Queue
- Auto-route findings to review queue when:
  - confidence < 60, or
  - severity = Critical.
- Reviewer can mark: Accepted, Dismissed, Needs follow-up.

**Acceptance Criteria**
- Queue status transitions are auditable.
- Critical findings require explicit reviewer acknowledgement.

### F6. Roles and Access
- Admin: full workspace actions.
- Reviewer: analyze, comment, resolve.
- Viewer: read/export only.

**Acceptance Criteria**
- Role checks enforced in API and UI routes.

### F7. Export
- Generate summary report with:
  - Contract metadata
  - Top risks
  - Review decisions
  - Export timestamp and actor

**Acceptance Criteria**
- Export includes all mandatory sections.
- Export action is logged.

### F8. Audit Logging
- Log core events: upload, analysis complete, review action, export.
- Include actor, timestamp, contract id, action payload summary.

**Acceptance Criteria**
- Audit records queryable by contract and date.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Single-contract analysis target <= 90 seconds in staging |
| Availability | 99% target for pilot environments |
| Security | TLS in transit, encrypted file storage at rest |
| Reliability | Retry transient LLM/API failures with bounded retries |
| Observability | Structured logs for all core actions |
| Usability | User can interpret top risks in <= 60 seconds |

---

## 7. Data and Legal Boundaries
- System output is not legal advice.
- User confirmation required before any “finalized” label.
- Contract files are private to workspace.
- Default retention:
  - Files: 12 months
  - Metadata/audit logs: longer for traceability

---

## 8. Error Handling Requirements
1. Upload failure -> reason + corrective action shown.
2. Extraction failure -> retry and manual support path shown.
3. Model timeout -> fallback model attempt + “partial results” marker.
4. Export failure -> retry preserved without data loss.

---

## 9. Success Metrics (v0.1 SLC)

| Metric | Target |
|---|---|
| End-to-end workflow completion rate | >= 85% in pilot |
| User-rated clarity for explanations | >= 4/5 |
| Critical-finding reviewer acknowledgement | 100% |
| Time to first actionable summary | <= 2 minutes |
| Export success rate | >= 98% |

---

## 10. Release Readiness Criteria
Release is allowed only if all are true:
1. All quality gates in `SLC_QUALITY_GATES.md` pass.
2. Core workflow demo succeeds with representative contracts.
3. No blocker/high defects open in core path.
4. Scope boundary docs reflect final implementation.


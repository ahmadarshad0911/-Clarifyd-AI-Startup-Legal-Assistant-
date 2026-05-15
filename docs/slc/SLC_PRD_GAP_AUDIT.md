# PRD Gap Audit — From MVP/Extended Ambiguity to SLC Explicitness

## Source Reviewed
- `C:\Users\ahmed\Desktop\Clarifyd Startup Contract Helper\PRD_AI_Contract_Risk_Analyzer.md`
- `C:\Users\ahmed\Desktop\Clarifyd Startup Contract Helper\PRD_Extended_Contract_Risk_Analyzer.md`

## Current-State Findings
- The PRD is feature-rich but not constrained for a 2-person, 2-week execution.
- MVP language still appears in roadmap/success sections while the document claims production readiness.
- Several requirements are aspirational and not operationally explicit (limits, defaults, fallback behavior, ownership).

## Gap Matrix

| Area | Gap in previous PRD | SLC explicit replacement |
|---|---|---|
| Scope model | Mixed MVP/enterprise language | Single model: **v0.1 SLC** only |
| Feature breadth | Too many parallel modules | One complete journey: upload → analyze → review → export |
| Team model | Implied larger team | Explicitly constrained to **2 owners (A/B)** |
| Timeline | Multi-month phases | Fixed **2-week plan** with backend-first sequencing |
| Supported formats | Inconsistent mentions | v0.1 supports **PDF + DOCX only** |
| File limits | Not consistent | Max file size and batch limits explicitly defined |
| Clause coverage | “15+ additional categories” vague | Fixed initial clause taxonomy list for v0.1 |
| Confidence behavior | Mentioned but not deterministic | Numeric thresholds and mandatory review triggers defined |
| Human-in-loop | Present but soft | Explicit “decision-support only” and no auto-approval policy |
| Compliance scope | Broad multi-region claims | Compliance checks limited to policy templates in v0.1 |
| Performance claims | Enterprise targets without baseline | SLC performance targets tied to local/staging environment |
| Security/compliance certs | SOC2/HIPAA claims in early phase | Certification work marked deferred; baseline controls defined |
| Data retention | Mentioned, not operationalized | Retention defaults and deletion behavior explicitly set |
| Error handling | Under-specified | User-visible error classes and retry policy defined |
| Integrations | Many named integrations | Integrations deferred except webhook-ready event model |
| QA/release | No hard gate criteria | Quality gates and release checklist formalized |
| Ownership | No clear task ownership | A/B ownership matrix with dependencies added |

## Assumptions Converted to Explicit Rules
1. **Legal boundary:** Output is assistance, not legal advice.
2. **Model variability:** Confidence gating + manual review is mandatory.
3. **Cost control:** Token budgets and fallback model policy defined.
4. **Data governance:** Contracts are private-by-default; export is role-restricted.
5. **Change control:** Scope additions require explicit defer/inclusion decision.

## Result
The SLC docs in this folder replace ambiguous planning with executable constraints and measurable acceptance criteria suitable for a two-person, 2-week delivery.


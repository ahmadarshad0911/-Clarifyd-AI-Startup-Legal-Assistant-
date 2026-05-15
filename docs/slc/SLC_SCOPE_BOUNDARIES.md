# SLC Scope Boundaries (v0.1)

## Scope Statement
Deliver a **Simple, Loveable, Complete** contract-risk workflow for small legal/procurement teams:
**Upload one contract, get clause-level risk findings with confidence and plain-language explanation, review low-confidence items, and export a concise risk report.**

## In Scope (Must Ship)
1. Contract upload (PDF, DOCX) with validation.
2. Text extraction and clause segmentation for a fixed clause taxonomy.
3. Clause-level risk scoring (Critical/High/Medium/Low/Info).
4. Confidence scoring per finding (0-100).
5. Manual-review queue for low-confidence or critical findings.
6. Plain-language explanation and suggested safer wording.
7. Single-organization workspace with basic role levels (Admin, Reviewer, Viewer).
8. Contract summary export (PDF/Markdown).
9. Audit trail for core actions (upload, analysis generated, review decision, export).

## Out of Scope (Deferred)
- SSO/SAML
- Multi-region deployments
- SOC 2/HIPAA certification process
- Marketplace-style integrations
- Full benchmarking database
- Multi-language support
- Automated legal approvals
- Advanced pricing/billing automation
- Complex workflow engines
- Custom model training or fine-tuning

## SLC Completeness Criteria
A new user can complete the full job without external tooling:
1. Upload contract successfully.
2. Receive understandable risk results.
3. Review and resolve flagged findings.
4. Export a usable report for stakeholder discussion.

## SLC Loveability Criteria
- Initial dashboard load under defined target.
- Risk summary readable in under 60 seconds.
- Each finding explains “why this matters.”
- UX has no dead-end states in the primary workflow.

## SLC Simplicity Constraints
- Max 1 organization type in v0.1.
- Max 2 document formats.
- Max 1 primary user journey.
- No custom rule builder UI in v0.1.

## Change Control Rules
- Any item not listed in “In Scope” is deferred by default.
- Scope additions require:
  1. Explicit trade-off against current scope,
  2. Owner reassignment,
  3. Update to week plan and quality gates.


# GitHub Repository Scaffold Plan (SLC v0.1)

## Goal
Create a clean, implementation-ready repository structure aligned to the 2-week SLC plan and two-person ownership model.

## Proposed Repository Structure

```text
ai-contract-risk-analyzer/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── services/
│   │   ├── schemas/
│   │   ├── models/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── Dockerfile
├── docs/
│   ├── slc/
│   └── ARCHITECTURE.md
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── docs-check.yml
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── docker-compose.yml
├── .env.example
└── README.md
```

## Scaffold Deliverables by Area

| Area | Deliverable | Owner |
|---|---|---|
| Backend | App skeleton, health endpoint, base schemas | Group Mate A |
| Frontend | Route shell, upload page shell, dashboard shell | Group Mate B |
| CI | Lint/test pipelines and docs consistency checks | Group Mate A |
| Governance | PR template, issue templates, branch rules | Group Mate B |

## Branching and PR Strategy
- Protected branch: `main`
- Working branches: `feature/<scope>`
- Required PR checklist:
  1. Scope reference to SLC docs
  2. Test evidence
  3. Docs updated when behavior changes

## Starter GitHub Workflows

### 1. `ci.yml`
- Trigger: PR and push to `main`
- Jobs:
  - backend lint + tests
  - frontend lint + tests
  - basic smoke checks

### 2. `docs-check.yml`
- Trigger: PR touching `docs/` or `README.md`
- Checks:
  - Markdown lint
  - Link integrity
  - SLC doc cross-reference validation

## Labels and Issue Taxonomy
- `scope:slc`
- `type:backend`
- `type:frontend`
- `type:docs`
- `priority:blocker|high|medium|low`
- `week:1|2`

## PR Template Essentials
- SLC scope item linked
- What changed
- How validated
- Risks and fallback
- Docs impact

## Setup Checklist
1. Create workflow files in `.github/workflows`.
2. Add issue and PR templates.
3. Protect `main` and require review.
4. Add CODEOWNERS mapping A/B responsibilities.
5. Add environment bootstrap instructions in README.

## Risks and Controls

| Risk | Control |
|---|---|
| Docs-code drift | docs-check CI + PR checklist |
| Unreviewed direct pushes | Protected branch rules |
| Scope creep through issues | Mandatory `scope:slc` label and gate review |


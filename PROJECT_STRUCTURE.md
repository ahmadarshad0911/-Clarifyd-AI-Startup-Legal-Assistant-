# Project Structure & Documentation Overview

## Complete Repository Structure

```
ai-contract-risk-analyzer/
├── 📄 README.md                      ← Start here! Project overview
├── 📄 CONTRIBUTING.md                ← How to contribute
├── 📄 LICENSE                        ← MIT License
├── 📄 GITHUB_SETUP.md                ← How to push to GitHub
├── 📄 docker-compose.yml             ← Local development setup
├── 📄 .gitignore                     ← Git ignore file
├── 📄 .env.example                   ← Environment variables template
│
├── 📁 docs/                          ← Documentation
│   ├── ARCHITECTURE.md               ← System design & microservices
│   ├── INSTALLATION.md               ← Setup guide (dev, staging, prod)
│   ├── API_DOCUMENTATION.md          ← REST API endpoints
│   ├── DATABASE_SCHEMA.md            ← PostgreSQL tables (to create)
│   ├── ROADMAP.md                    ← Feature roadmap
│   ├── SECURITY.md                   ← Security & compliance (to create)
│   ├── DEPLOYMENT.md                 ← Deployment guide (to create)
│   ├── TESTING.md                    ← Testing strategy (to create)
│   └── PRD_Extended_Contract_Risk_Analyzer.md  ← Full PRD
│
├── 📁 backend/                       ← FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  ← FastAPI app entry point
│   │   ├── config.py                ← Configuration & settings
│   │   ├── dependencies.py          ← Dependency injection
│   │   │
│   │   ├── 📁 api/                  ← API routes
│   │   │   ├── __init__.py
│   │   │   ├── contracts.py         ← POST/GET contracts
│   │   │   ├── analysis.py          ← POST analyze, GET results
│   │   │   ├── comments.py          ← Comments & collaboration
│   │   │   ├── auth.py              ← Login, signup, token refresh
│   │   │   ├── teams.py             ← Team management
│   │   │   └── search.py            ← Full-text search
│   │   │
│   │   ├── 📁 services/             ← Business logic
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py      ← JWT, OAuth, password hashing
│   │   │   ├── contract_service.py  ← File upload, OCR, storage
│   │   │   ├── analysis_service.py  ← Multi-pass AI pipeline
│   │   │   ├── ai_pipeline.py       ← Pass 1, 2, 3 logic
│   │   │   ├── llm_service.py       ← OpenAI API calls
│   │   │   ├── collaboration_service.py ← Comments, workflows
│   │   │   └── search_service.py    ← Elasticsearch integration
│   │   │
│   │   ├── 📁 models/               ← Database models (SQLAlchemy)
│   │   │   ├── __init__.py
│   │   │   ├── user.py              ← User model
│   │   │   ├── organization.py      ← Organization/tenant
│   │   │   ├── contract.py          ← Contract metadata
│   │   │   ├── clause.py            ← Extracted clauses
│   │   │   ├── risk_analysis.py     ← Risk scores & findings
│   │   │   ├── comment.py           ← Comments & collaboration
│   │   │   └── audit_log.py         ← Audit trail
│   │   │
│   │   ├── 📁 schemas/              ← Pydantic request/response models
│   │   │   ├── __init__.py
│   │   │   ├── user.py              ← User request/response DTOs
│   │   │   ├── contract.py          ← Contract payloads
│   │   │   ├── analysis.py          ← Analysis request/response
│   │   │   └── comment.py           ← Comment payloads
│   │   │
│   │   ├── 📁 utils/                ← Utility functions
│   │   │   ├── __init__.py
│   │   │   ├── security.py          ← JWT validation, password hashing
│   │   │   ├── llm_prompts.py       ← Prompt templates
│   │   │   ├── validators.py        ← Input validation
│   │   │   ├── exceptions.py        ← Custom exceptions
│   │   │   └── constants.py         ← Constants & enums
│   │   │
│   │   ├── 📁 tasks/                ← Celery async tasks
│   │   │   ├── __init__.py
│   │   │   ├── contract_tasks.py    ← OCR, text extraction
│   │   │   ├── analysis_tasks.py    ← Run AI pipeline
│   │   │   ├── cleanup_tasks.py     ← Old file deletion
│   │   │   └── notification_tasks.py ← Email/Slack sends
│   │   │
│   │   └── 📁 db/                   ← Database utilities
│   │       ├── __init__.py
│   │       ├── session.py           ← DB session management
│   │       └── base.py              ← Base models
│   │
│   ├── 📁 migrations/                ← Alembic database migrations
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── (auto-generated migration files)
│   │
│   ├── 📁 tests/                     ← Test suite
│   │   ├── __init__.py
│   │   ├── conftest.py              ← Pytest fixtures
│   │   ├── 📁 unit/                 ← Unit tests
│   │   │   ├── test_auth.py
│   │   │   ├── test_contract_service.py
│   │   │   ├── test_analysis_service.py
│   │   │   └── test_llm_service.py
│   │   ├── 📁 integration/          ← Integration tests
│   │   │   ├── test_api_contracts.py
│   │   │   ├── test_api_analysis.py
│   │   │   └── test_db_operations.py
│   │   └── 📁 fixtures/             ← Test data
│   │       ├── sample_contracts/
│   │       └── mock_responses.py
│   │
│   ├── requirements.txt               ← Python dependencies
│   ├── requirements-dev.txt           ← Dev dependencies (pytest, black, etc.)
│   ├── Dockerfile                     ← Docker image build
│   ├── .dockerignore
│   ├── alembic.ini                    ← Alembic config
│   └── celery_app.py                  ← Celery app initialization
│
├── 📁 frontend/                       ← Next.js / React Frontend
│   ├── app/                           ← Next.js app directory
│   │   ├── 📁 (auth)/                ← Auth route group
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── 📁 dashboard/             ← User dashboard
│   │   │   ├── page.tsx              ← Dashboard home
│   │   │   ├── layout.tsx
│   │   │   └── 📁 contracts/
│   │   │       ├── page.tsx          ← Contract list
│   │   │       ├── [id]/page.tsx     ← Contract viewer
│   │   │       └── upload/page.tsx   ← Upload form
│   │   │
│   │   ├── 📁 api/                   ← API routes (if needed)
│   │   │   └── auth/route.ts
│   │   │
│   │   ├── layout.tsx                ← Root layout
│   │   └── page.tsx                  ← Landing page
│   │
│   ├── 📁 components/                ← Reusable React components
│   │   ├── 📁 Auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   │
│   │   ├── 📁 Contract/
│   │   │   ├── ContractUpload.tsx    ← Drag & drop upload
│   │   │   ├── ContractViewer.tsx    ← Display contract
│   │   │   ├── RiskDashboard.tsx     ← Risk summary
│   │   │   ├── ClauseHighlight.tsx   ← Clause coloring
│   │   │   └── ClauseDetails.tsx     ← Clause info panel
│   │   │
│   │   ├── 📁 Collaboration/
│   │   │   ├── CommentThread.tsx     ← Comments UI
│   │   │   ├── MentionInput.tsx      ← @mention support
│   │   │   └── CollaborationPanel.tsx
│   │   │
│   │   ├── 📁 Common/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   │
│   │   └── 📁 Analytics/
│   │       ├── RiskChart.tsx
│   │       ├── MetricsCard.tsx
│   │       └── TrendChart.tsx
│   │
│   ├── 📁 hooks/                     ← Custom React hooks
│   │   ├── useApi.ts                 ← Fetch wrapper
│   │   ├── useAuth.ts                ← Auth context
│   │   ├── useContracts.ts           ← Contract queries
│   │   └── useWebSocket.ts           ← WS subscriptions
│   │
│   ├── 📁 utils/                     ← Utility functions
│   │   ├── api.ts                    ← API client
│   │   ├── auth.ts                   ← Auth utilities
│   │   ├── validation.ts             ← Form validation
│   │   └── constants.ts              ← Constants
│   │
│   ├── 📁 types/                     ← TypeScript interfaces
│   │   ├── index.ts
│   │   ├── contract.ts               ← Contract types
│   │   ├── analysis.ts               ← Analysis response types
│   │   ├── user.ts                   ← User types
│   │   └── api.ts                    ← API types
│   │
│   ├── 📁 styles/                    ← Global styles
│   │   ├── globals.css
│   │   ├── variables.css
│   │   └── themes.css
│   │
│   ├── 📁 public/                    ← Static assets
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   │
│   ├── 📁 tests/                     ← Frontend tests
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   │
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env.example
│
├── 📁 .github/                       ← GitHub configuration
│   ├── 📁 workflows/                ← CI/CD pipelines
│   │   ├── ci.yml                   ← Tests on push/PR
│   │   ├── deploy-staging.yml       ← Deploy to staging
│   │   └── deploy-production.yml    ← Deploy to production
│   │
│   └── 📁 ISSUE_TEMPLATE/           ← Issue templates
│       ├── bug_report.md
│       ├── feature_request.md
│       └── question.md
│
├── 📁 k8s/                           ← Kubernetes manifests (optional)
│   ├── 📁 dev/
│   ├── 📁 staging/
│   └── 📁 production/
│
├── 📁 scripts/                       ← Utility scripts
│   ├── seed_data.py                 ← Load sample contracts
│   ├── export_data.py               ← Data export
│   ├── db_backup.sh                 ← Database backup
│   └── health_check.sh              ← System health check
│
├── 📁 .vscode/                       ← VSCode settings (optional)
│   ├── settings.json
│   ├── extensions.json
│   └── launch.json
│
└── .pre-commit-config.yaml           ← Pre-commit hooks (linting, formatting)
```

---

## Documentation Files Overview

### 📋 Main Documentation

| File | Purpose | Audience |
|------|---------|----------|
| **README.md** | Project overview, quick start, features | Everyone |
| **CONTRIBUTING.md** | How to contribute, code standards, PR process | Developers |
| **GITHUB_SETUP.md** | How to set up GitHub repo and push code | First-time setup |
| **PROJECT_STRUCTURE.md** | This file - directory layout | Development |

### 📚 Technical Documentation

| File | Purpose | Audience |
|------|---------|----------|
| **docs/ARCHITECTURE.md** | System design, microservices, data flows | Architects, Senior Devs |
| **docs/INSTALLATION.md** | Setup for dev/staging/production | DevOps, Developers |
| **docs/API_DOCUMENTATION.md** | REST API endpoints, auth, webhooks | API Users, Frontend Devs |
| **docs/DATABASE_SCHEMA.md** | PostgreSQL tables, relationships | Backend Devs, DBAs |
| **docs/ROADMAP.md** | Features planned by phase | Product, Stakeholders |
| **docs/SECURITY.md** | Auth, encryption, compliance | Security, DevOps |
| **docs/DEPLOYMENT.md** | Kubernetes, Docker, CI/CD | DevOps, DevSecOps |
| **docs/TESTING.md** | Unit, integration, e2e testing | QA, Backend Devs |

### 📖 Reference

| File | Purpose |
|------|---------|
| **docs/PRD_Extended_Contract_Risk_Analyzer.md** | Complete Product Requirements |
| **LICENSE** | MIT License terms |
| **.gitignore** | Files to exclude from git |
| **.env.example** | Environment variables template |
| **docker-compose.yml** | Local development setup |

---

## How to Use This Repository

### For New Developers
```bash
1. Read README.md for overview
2. Read CONTRIBUTING.md for code standards
3. Read INSTALLATION.md for local setup
4. Run: docker-compose up
5. Create feature branch: git checkout -b feature/your-feature
6. Make your changes
7. Submit PR
```

### For DevOps Engineers
```bash
1. Read ARCHITECTURE.md for system design
2. Read INSTALLATION.md for setup
3. Read DEPLOYMENT.md for production deployment
4. Read SECURITY.md for compliance requirements
5. Set up Kubernetes, monitoring, backups
```

### For Product Managers
```bash
1. Read README.md for overview
2. Read ROADMAP.md for planned features
3. Read full PRD in docs/PRD_Extended_Contract_Risk_Analyzer.md
4. Review API_DOCUMENTATION.md for capabilities
```

### For Investors/Stakeholders
```bash
1. Read README.md for executive summary
2. Review ROADMAP.md for timeline & milestones
3. Check ARCHITECTURE.md for tech stack quality
4. Review docs/DEPLOYMENT.md for scalability
5. Read CONTRIBUTING.md to understand team collaboration
```

---

## Key Files to Modify

### When Starting Local Development
- [ ] Copy `.env.example` to `.env` and fill in API keys
- [ ] Run `docker-compose up` to start services
- [ ] Check `INSTALLATION.md` for database setup

### When Adding New Features
- [ ] Create API endpoint in `backend/app/api/`
- [ ] Add service logic in `backend/app/services/`
- [ ] Add tests in `backend/tests/`
- [ ] Create React component in `frontend/components/`
- [ ] Add type definitions in `frontend/types/`
- [ ] Update `docs/API_DOCUMENTATION.md` if adding API endpoints

### When Adding Dependencies
- **Python:** Add to `backend/requirements.txt`
- **Node.js:** Run `npm install` in `frontend/`
- **System:** Update `Dockerfile` installations

### When Deploying
- Update `.env` with production secrets
- Run database migrations: `alembic upgrade head`
- Update Kubernetes manifests in `k8s/production/`
- Check CI/CD pipeline in `.github/workflows/`

---

## Pre-Commit Checklist

Before committing code:

- [ ] Code passes linter (`black`, `flake8`, `eslint`)
- [ ] All tests pass (`pytest`, `npm test`)
- [ ] TypeScript compiles without errors (`tsc`)
- [ ] No secrets in commit (no `.env`, API keys, etc.)
- [ ] Commit message follows format: `<type>(<scope>): <description>`
- [ ] Related issue is referenced (e.g., "Fixes #123")

---

## Common Development Workflows

### Adding a New API Endpoint

1. **Define schema** in `backend/app/schemas/`
```python
class ContractCreateRequest(BaseModel):
    file_name: str
    ...
```

2. **Create route** in `backend/app/api/`
```python
@router.post("/contracts")
async def create_contract(data: ContractCreateRequest):
    ...
```

3. **Add service method** in `backend/app/services/`
```python
async def create_contract(self, data: ContractCreateRequest):
    ...
```

4. **Add tests** in `backend/tests/unit/`
```python
def test_create_contract():
    ...
```

5. **Update documentation** in `docs/API_DOCUMENTATION.md`

---

## Repository Statistics

```
Lines of Code:
  - Backend: ~500-1000 LOC (MVP)
  - Frontend: ~400-600 LOC (MVP)
  - Tests: ~600-800 LOC
  - Documentation: ~5000+ LOC

Files:
  - Backend: 40-50 files
  - Frontend: 30-40 files
  - Docs: 8-10 markdown files
  - Total: 100+ files

Languages:
  - Python 3.11+ (Backend)
  - TypeScript 5.0+ (Frontend)
  - SQL (PostgreSQL)
  - Markdown (Documentation)
```

---

## Support & Resources

- **GitHub Issues:** Bug reports, feature requests
- **GitHub Discussions:** Questions, ideas, announcements
- **Documentation:** `docs/` folder
- **Slack:** (to be added)
- **Email:** support@example.com


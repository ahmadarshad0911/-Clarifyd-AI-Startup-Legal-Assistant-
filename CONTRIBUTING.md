# Contributing to AI Contract Risk Analyzer

Thank you for your interest in contributing! We welcome contributions from the community. Please read this guide before submitting PRs.

## Code of Conduct

- Be respectful and inclusive
- No harassment or discrimination
- Report issues to: conduct@example.com

## Getting Started

### 1. Fork the Repository
```bash
# Click "Fork" on GitHub
git clone https://github.com/yourusername/ai-contract-risk-analyzer.git
cd ai-contract-risk-analyzer
```

### 2. Set Up Development Environment

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements-dev.txt

# Set up pre-commit hooks
pre-commit install
```

**Frontend:**
```bash
cd frontend
npm install
npm run lint
```

### 3. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

## Development Workflow

### Code Standards

#### Python (Backend)
- **Style:** PEP 8 + Black formatter
- **Linting:** Flake8, pylint
- **Type checking:** Mypy
- **Testing:** pytest with > 80% coverage

**Formatting:**
```bash
# Format code
black app/ tests/

# Run linter
flake8 app/ tests/
pylint app/

# Type check
mypy app/
```

#### TypeScript/JavaScript (Frontend)
- **Style:** ESLint + Prettier
- **Linting:** ESLint recommended rules
- **Type checking:** TypeScript strict mode
- **Testing:** Jest with > 80% coverage

**Formatting:**
```bash
# Format code
npm run format

# Run linter
npm run lint

# Type check
npm run type-check
```

### Commit Message Format

Follow conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style (formatting, semicolons, etc.)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Test additions/updates
- `chore:` Build, dependencies, tooling
- `ci:` CI/CD changes

**Examples:**
```bash
git commit -m "feat(analysis): add multi-pass validation pipeline"
git commit -m "fix(api): handle null values in risk scoring"
git commit -m "docs(readme): update installation instructions"
```

### Testing

#### Backend Tests
```bash
cd backend

# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_analysis_pipeline.py -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run integration tests
pytest tests/integration/ -v

# Run only fast tests (unit tests)
pytest tests/unit/ -v
```

#### Frontend Tests
```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- ContractViewer.test.tsx
```

### Local Testing

```bash
# Start full stack locally
docker-compose -f docker-compose.dev.yml up

# Run backend tests in Docker
docker-compose -f docker-compose.test.yml up

# Check code quality
cd backend && make lint
cd frontend && npm run lint
```

## Submitting Changes

### 1. Push to Your Fork
```bash
git push origin feature/your-feature-name
```

### 2. Create Pull Request
- Go to GitHub and click "Compare & pull request"
- Fill out the PR template
- Reference related issues (e.g., "Fixes #123")
- Ensure CI/CD passes

### 3. PR Requirements

**Before submitting, ensure:**
- ✅ Code passes all tests (`pytest` or `npm test`)
- ✅ Code is formatted (`black`, `prettier`)
- ✅ Linting passes (`flake8`, `eslint`)
- ✅ Type checking passes (`mypy`, `tsc`)
- ✅ Test coverage > 80%
- ✅ PR has descriptive title and description
- ✅ All commits follow conventional commits format
- ✅ No merge conflicts
- ✅ Related issues are referenced

### 4. PR Template

```markdown
## Description
Brief description of changes

## Related Issues
Fixes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Added tests
- [ ] Updated tests
- [ ] All tests pass

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] Coverage maintained > 80%
```

### 5. Code Review

Maintainers will review your PR. Be ready to:
- Respond to feedback promptly
- Make requested changes
- Engage in constructive discussion
- Update your PR based on feedback

---

## Reporting Issues

### Bug Reports
Include:
1. **Summary:** What's the bug?
2. **Steps to reproduce:** How can we replicate it?
3. **Expected behavior:** What should happen?
4. **Actual behavior:** What actually happens?
5. **Environment:** OS, Python/Node version, etc.
6. **Logs/Screenshots:** Error messages, stack traces

**Template:**
```markdown
## Description
[Describe the bug]

## Steps to Reproduce
1. ...
2. ...

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- OS: [Windows, macOS, Linux]
- Python: [version]
- Node: [version]

## Logs
[Stack traces, error messages]
```

### Feature Requests
Include:
1. **Use case:** Why do you need this?
2. **Proposed solution:** How should it work?
3. **Alternatives:** Other ways to solve this?
4. **Additional context:** Screenshots, examples, etc.

---

## Development Best Practices

### Architecture
- Follow microservices design
- Use dependency injection
- Keep functions small and focused
- Write self-documenting code

### Testing
- Write tests as you code
- Aim for > 80% coverage
- Test happy path and edge cases
- Mock external dependencies

### Documentation
- Add docstrings to functions/classes
- Update README if needed
- Add comments for complex logic
- Keep docs in sync with code

### Performance
- Profile before optimizing
- Use EXPLAIN on slow queries
- Cache frequently accessed data
- Batch process when possible

### Security
- Never commit secrets (use .env file)
- Validate user inputs
- Use parameterized queries (prevent SQL injection)
- Hash passwords, never store plaintext
- Follow OWASP top 10

---

## Project Structure

```
ai-contract-risk-analyzer/
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── services/      # Business logic
│   │   ├── models/        # Database models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── utils/         # Utility functions
│   │   └── main.py        # App entry point
│   ├── tests/             # Test suite
│   ├── requirements.txt   # Dependencies
│   └── Dockerfile
│
├── frontend/              # Next.js frontend
│   ├── app/
│   │   ├── components/    # React components
│   │   ├── pages/         # Next.js pages
│   │   ├── hooks/         # Custom hooks
│   │   ├── utils/         # Utility functions
│   │   └── layout.tsx     # Root layout
│   ├── public/            # Static assets
│   ├── tests/             # Test suite
│   ├── package.json
│   └── Dockerfile
│
├── docs/                  # Documentation
│   ├── ARCHITECTURE.md
│   ├── API_DOCUMENTATION.md
│   ├── DATABASE_SCHEMA.md
│   └── ...
│
├── .github/
│   └── workflows/         # CI/CD pipelines
│
├── docker-compose.yml
└── README.md
```

---

## CI/CD Pipeline

Our automated pipeline runs on every PR:

1. **Linting:** Code style checks
2. **Type checking:** TypeScript/Mypy validation
3. **Unit tests:** Fast tests (< 1 min)
4. **Integration tests:** Full stack tests (< 5 min)
5. **Security scan:** Vulnerability scanning
6. **Coverage report:** 80%+ requirement

**View results:** Check GitHub Actions tab on your PR

---

## Deployment

### Staging
```bash
# Create PR and merge to `develop` branch
# CI/CD automatically deploys to staging
# Test at: https://staging.example.com
```

### Production
```bash
# Merge approved PR to `main` branch
# CI/CD automatically deploys to production
# Rollback available if issues detected
```

---

## Questions & Support

- 💬 **Discussions:** [GitHub Discussions](https://github.com/yourusername/ai-contract-risk-analyzer/discussions)
- 🐛 **Issues:** [GitHub Issues](https://github.com/yourusername/ai-contract-risk-analyzer/issues)
- 📧 **Email:** dev@example.com
- 🔗 **Documentation:** [docs/](./docs/)

---

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- GitHub contributor graph

Thank you for contributing! 🙏


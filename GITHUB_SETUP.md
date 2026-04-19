# GitHub Setup & First Push Guide

## Quick Summary
This guide explains how to create a GitHub repository and push your local code.

---

## Step 1: Create GitHub Repository

### Option A: GitHub Web Interface (Easiest)

1. Go to https://github.com/new
2. Fill in details:
   - **Repository name:** `ai-contract-risk-analyzer`
   - **Description:** "Production-grade SaaS platform for AI-powered contract analysis and risk assessment"
   - **Visibility:** Public (or Private if preferred)
   - **Initialize:** Leave unchecked (we have local code)
3. Click "Create repository"

### Option B: GitHub CLI
```bash
gh repo create ai-contract-risk-analyzer \
  --description "Production-grade SaaS platform for AI-powered contract analysis" \
  --public \
  --remote=origin \
  --source=.
```

---

## Step 2: Initialize Local Git Repository

Navigate to project root and initialize git:

```bash
cd ai-contract-risk-analyzer

# Initialize git
git init

# Set default branch to main
git config --global init.defaultBranch main

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/ai-contract-risk-analyzer.git

# Verify remote is set
git remote -v
```

---

## Step 3: Configure Git

```bash
# Set your Git identity (global)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Or set just for this repository (local)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Verify settings
git config --list
```

---

## Step 4: Stage and Commit

```bash
# Check status
git status

# Stage all files (careful!)
git add .

# Or stage specific files
git add README.md CONTRIBUTING.md docs/

# Verify what will be committed
git status

# Commit with meaningful message
git commit -m "Initial commit: AI Contract Risk Analyzer MVP

- README with quick start guide
- Complete architecture documentation
- API documentation and design specs
- Installation guide for dev, staging, production
- Contributing guidelines and code standards
- Docker compose for local development
- MIT License and .gitignore
- Comprehensive project structure
- Roadmap for feature development"
```

---

## Step 5: Push to GitHub

```bash
# Push to remote (creates main branch on GitHub)
git push -u origin main

# Or if default branch is named differently:
git push -u origin master

# Verify push succeeded
git log --oneline
```

---

## Step 6: Verify on GitHub

1. Go to https://github.com/YOUR_USERNAME/ai-contract-risk-analyzer
2. You should see all your files
3. README should display at the bottom of the page

---

## Setting Up Branches

### Create Development Branch
```bash
# Create and switch to develop branch
git checkout -b develop

# Push develop branch to GitHub
git push -u origin develop
```

### Set GitHub Branch Protection (Optional but Recommended)

In GitHub repository settings:
1. Settings → Branches
2. Add branch protection rule
   - Pattern: `main`
   - Require pull request reviews: 1
   - Dismiss stale PR approvals: Yes
3. Save

---

## Useful Git Commands

### View History
```bash
# View commit log
git log --oneline

# View specific commits
git log --oneline -10

# View changes
git diff HEAD
```

### Create Feature Branch
```bash
# Create branch from main
git checkout -b feature/amazing-feature

# Make changes...

# Push feature branch
git push -u origin feature/amazing-feature

# Create Pull Request on GitHub
```

### Keep Fork Synced (if you forked)
```bash
# Add upstream remote
git remote add upstream https://github.com/original-owner/repo.git

# Fetch latest from upstream
git fetch upstream

# Rebase your main branch
git rebase upstream/main

# Push to your fork
git push origin main
```

---

## GitHub Actions Setup (CI/CD)

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install backend dependencies
      run: |
        cd backend
        pip install -r requirements-dev.txt
    
    - name: Run backend tests
      run: |
        cd backend
        pytest tests/ -v
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install frontend dependencies
      run: |
        cd frontend
        npm install
    
    - name: Run frontend tests
      run: |
        cd frontend
        npm test -- --watchAll=false
```

Push this workflow:
```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow"
git push origin main
```

---

## GitHub Pages Setup (Optional)

Host documentation on GitHub Pages:

```bash
# Create docs branch
git checkout -b gh-pages

# Or if using docs/ folder:
# GitHub will automatically serve from docs/ folder
```

In repository settings:
1. Settings → Pages
2. Source: Deploy from a branch → `gh-pages` or `/docs`
3. Save

---

## Protecting Secrets

**NEVER push:**
- `.env` files with real secrets
- API keys (OpenAI, AWS, etc.)
- Database passwords
- Private keys

These are gitignored by default. Double-check:

```bash
# Check if any secrets are staged
git diff --cached | grep -i "password\|key\|secret\|token"

# If any found, unstage
git reset

# Delete from staged area
git rm --cached .env
```

---

## GitHub Settings Recommendations

### Repository Settings

1. **General**
   - Description: "Production-grade SaaS platform for AI-powered contract analysis"
   - Website: (leave or add your website)
   - Topics: `ai`, `contracts`, `legal`, `saas`, `fastapi`, `nextjs`

2. **Code Security**
   - Enable "Dependabot alerts"
   - Enable "Dependabot security updates"
   - Enable "Secret scanning" (if private)

3. **Collaborators**
   - Add team members: Settings → Collaborators

4. **Branch Protection** (for main)
   - Require pull request reviews (1+ person)
   - Dismiss stale PR approvals
   - Require status checks to pass

### Issues Template

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug report
about: Create a report to help us improve
---

**Describe the bug**
A clear description of the bug.

**Steps to reproduce**
1. ...
2. ...

**Expected behavior**
What should happen.

**Actual behavior**
What actually happens.

**Environment**
- OS: [e.g., Ubuntu 20.04]
- Python: [e.g., 3.11]
- Node: [e.g., 18.x]

**Logs**
Stack traces or error messages.
```

### Pull Request Template

Create `.github/pull_request_template.md`:

```markdown
## Description
Brief description of changes.

## Type
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change

## Testing
- [ ] Added tests
- [ ] All tests pass
- [ ] Tested manually

## Checklist
- [ ] Code follows guidelines
- [ ] Documentation updated
- [ ] Commits are clear
```

---

## Troubleshooting

### "Remote origin already exists"
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/ai-contract-risk-analyzer.git
```

### "Permission denied (publickey)"
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Add to GitHub: Settings → SSH Keys

# Or use HTTPS instead of SSH
git remote set-url origin https://github.com/YOUR_USERNAME/ai-contract-risk-analyzer.git

# For HTTPS, use a Personal Access Token (PAT)
# Generate at: GitHub Settings → Developer settings → Personal access tokens
# Create token with 'repo' scope
# Use as password when pushing
```

### "Failed to push: authentication failed"
```bash
# Clear stored credentials
git config --global --unset credential.helper

# Or use Personal Access Token instead of password
# Generate at: GitHub Settings → Developer settings → Personal access tokens (classic)
# Use token as password: git push (enter token when prompted)
```

---

## Next Steps

1. ✅ Create GitHub repository
2. ✅ Initialize local git
3. ✅ Push initial commit
4. ✅ Set up branch protection
5. ✅ Enable GitHub Actions
6. ✅ Invite collaborators
7. 📝 Add team members to project
8. 🚀 Start first sprint

---

## Resources

- [GitHub Docs](https://docs.github.com)
- [Git Book](https://git-scm.com/book/en/v2)
- [GitHub Actions](https://github.com/features/actions)
- [Git Cheat Sheet](https://github.github.com/training-kit/downloads/github-git-cheat-sheet.pdf)


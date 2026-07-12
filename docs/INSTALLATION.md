# Installation Guide

> ## ⚠️ AS-BUILT NOTICE
>
> Sections below referencing **Elasticsearch, Redis, `gpt-4o`, or `postgres_data`/`elasticsearch_data`
> volumes are aspirational and NOT part of the shipped stack** — ignore them. The real system needs only:
> **Python 3.11 + FastAPI backend**, **Node 20 + Next.js 14 frontend**, and a DB (**SQLite** in dev,
> **Postgres·Neon** in prod). No Redis, no Elasticsearch.
>
> **Real quick start** (see [`../README.md`](../README.md) for the authoritative version):
> ```bash
> # backend
> cd backend && python -m venv .venv && .venv/Scripts/activate
> pip install -r requirements-dev.txt
> cp .env.example .env    # set REASONING_* (NVIDIA NIM) + Clerk keys
> uvicorn app.main:app --reload --port 8000
> # frontend (separate shell)
> cd frontend && npm install && npm run dev    # :3000
> # or both: docker compose up --build
> ```
> Reasoning env (NVIDIA NIM): `REASONING_BASE_URL=https://integrate.api.nvidia.com/v1`,
> `REASONING_MODEL=meta/llama-3.1-70b-instruct`, `REASONING_MODEL_FALLBACK=nvidia/llama-3.3-nemotron-super-49b-v1.5`,
> `REASONING_MAX_RPM=30`. Architecture of record: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start with Docker](#quick-start-with-docker)
3. [Manual Installation](#manual-installation)
4. [Environment Setup](#environment-setup)
5. [Database Setup](#database-setup)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required
- **Git** 2.20+
- **Docker** 20.10+ and **Docker Compose** 1.29+ (for Docker setup)
- OR **Python** 3.11+ and **Node.js** 18+ (for manual setup)
- **Reasoning API key** (OpenAI or Kimi)

### System Requirements
- **Disk Space:** 5 GB minimum
- **RAM:** 4 GB minimum (8 GB recommended)
- **CPU:** 2 cores minimum (4 cores recommended)

### Supported Operating Systems
- ✅ macOS (Intel & Apple Silicon)
- ✅ Ubuntu 20.04+ / Debian 11+
- ✅ Fedora / CentOS / RHEL
- ✅ Windows 10/11 (with WSL2) or Windows Server 2019+

---

## Quick Start with Docker (Recommended)

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/ai-contract-risk-analyzer.git
cd ai-contract-risk-analyzer
```

### 2. Copy Environment File
```bash
cp .env.example .env
```

### 3. Configure Environment
Edit `.env` file and set:
```env
REASONING_PROVIDER=openai  # openai or kimi
REASONING_API_KEY=...      # Your provider API key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contract_analyzer
REDIS_URL=redis://localhost:6379/0

# Clerk (primary auth in prod)
CLERK_ISSUER=https://clerk.<your-domain>
CLERK_JWKS_URL=https://clerk.<your-domain>/.well-known/jwks.json
CLERK_SECRET_KEY=sk_live_...     # Backend API: user lookup + admin delete
CLERK_WEBHOOK_SECRET=whsec_...   # Svix signing secret for POST /webhooks/clerk
```

**`CLERK_WEBHOOK_SECRET`** — from *Clerk dashboard → Webhooks → your endpoint → Signing Secret*. Point the
endpoint at `<backend>/webhooks/clerk` and subscribe it to `user.deleted`.

The receiver **fails closed**: with no secret it rejects every request with `503`, and a user deleted from the
Clerk dashboard will stay in your database. Deletion from the in-app admin console works regardless.

> On DigitalOcean this variable must be scoped **`RUN_TIME`**. A build-time-only scope is invisible to the
> running process and is indistinguishable from a missing secret. Verify by POSTing an unsigned request to
> `/webhooks/clerk`: `401` = secret loaded and verification active; `503` = the app cannot see it.

### 4. Start Services
```bash
# Start all containers (frontend, backend, database, redis, elasticsearch)
docker-compose up -d

# Verify containers are running
docker-compose ps
```

### 5. Initialize Database
```bash
# Run migrations
docker-compose exec backend alembic upgrade head

# Seed initial data (optional)
docker-compose exec backend python scripts/seed_data.py
```

### 6. Access the Application

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:3000 | Next.js app |
| Backend API | http://localhost:8000 | FastAPI server |
| API Docs | http://localhost:8000/docs | Swagger UI |
| pgAdmin | http://localhost:5050 | Database admin |

### 7. Create User Account
1. Open http://localhost:3000
2. Click "Sign Up"
3. Enter email and password
4. Confirm email (in development, check console logs)
5. Login and upload a contract!

### 8. Stop Services
```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

---

## Manual Installation

### Backend Setup

#### 1. Create Virtual Environment
```bash
cd backend
python3.11 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate     # Windows
```

#### 2. Install Dependencies
```bash
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Optional: Development dependencies
pip install -r requirements-dev.txt  # For testing, linting, etc.
```

#### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

#### 4. Initialize Database

**First time setup:**
```bash
# Make sure PostgreSQL is running
alembic upgrade head
python scripts/seed_data.py  # Optional: load sample data
```

**Existing setup:**
```bash
alembic upgrade head
```

#### 5. Run Backend
```bash
# Development mode (with auto-reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production mode (requires Gunicorn)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
```

Backend will be available at http://localhost:8000

---

### Frontend Setup

#### 1. Install Dependencies
```bash
cd frontend
npm install
```

#### 2. Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local if needed
```

#### 3. Run Frontend
```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm run start
```

Frontend will be available at http://localhost:3000

---

### Database Setup (PostgreSQL)

#### Option 1: Using Docker
```bash
docker run --name postgres_contract_analyzer \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=contract_analyzer \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

# Run migrations
cd backend
alembic upgrade head
```

#### Option 2: Local PostgreSQL Installation

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb contract_analyzer

# Run migrations
cd backend
alembic upgrade head
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
sudo -u postgres psql -c "CREATE DATABASE contract_analyzer;"

# Run migrations
cd backend
alembic upgrade head
```

**Windows:**
1. Download from https://www.postgresql.org/download/windows/
2. Run installer with default settings
3. Open pgAdmin and create database
4. Run migrations: `alembic upgrade head`

---

### Redis Setup (Caching & Job Queue)

#### Option 1: Using Docker
```bash
docker run --name redis_contract_analyzer \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine
```

#### Option 2: Local Redis Installation

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
```

**Windows:**
- Download from https://github.com/microsoftarchive/redis/releases
- Or use WSL2 with Linux instructions above

---

### Elasticsearch Setup (Full-Text Search)

#### Using Docker (Recommended)
```bash
docker run --name elasticsearch \
  -e discovery.type=single-node \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  -p 9200:9200 \
  elasticsearch:8.5.0
```

#### Local Installation
```bash
# macOS
brew install elasticsearch-full

# Ubuntu/Debian
wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.5.0-amd64.deb
sudo dpkg -i elasticsearch-8.5.0-amd64.deb
```

---

## Environment Setup

### API Keys

#### Reasoning API Key (NVIDIA NIM — current)
1. Create an API key at build.nvidia.com (NVIDIA NIM).
2. Add provider settings to `.env`:
```env
REASONING_PROVIDER=kimi                                        # provider class name (OpenAI-compatible)
REASONING_BASE_URL=https://integrate.api.nvidia.com/v1
REASONING_API_KEY=...
REASONING_MODEL=meta/llama-3.1-70b-instruct
REASONING_MODEL_FALLBACK=nvidia/llama-3.3-nemotron-super-49b-v1.5
REASONING_MAX_RPM=30
```

#### AWS S3 (Optional - for file storage)
1. Create AWS IAM user with S3 permissions
2. Get access key and secret key
3. Add to `.env`:
```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

#### Email Service (Optional - for notifications)
1. Sign up for SendGrid (free tier: 100 emails/day)
2. Get API key
3. Add to `.env`:
```env
SMTP_PASSWORD=SG.your-key-here
```

---

## Verification

### Verify Backend
```bash
# Check backend is running
curl http://localhost:8000/docs

# Check health status
curl http://localhost:8000/health
```

Expected response:
```json
{"status": "healthy", "version": "1.0.0"}
```

### Verify Frontend
```bash
# Check frontend is running
curl http://localhost:3000

# Check can reach API
curl -X GET http://localhost:3000/api/health
```

### Verify Database
```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/contract_analyzer

# Check tables exist
\dt
```

### Verify Redis
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG
```

### Verify Elasticsearch
```bash
# Check Elasticsearch is running
curl http://localhost:9200/

# Expected response shows ES version
```

---

## Configuration Options

### Backend Configuration (`.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `ENVIRONMENT` | development | dev, staging, or production |
| `DEBUG` | True | Enable debug mode |
| `LOG_LEVEL` | INFO | DEBUG, INFO, WARNING, ERROR |
| `DATABASE_URL` | postgresql://... | Database connection string |
| `OPENAI_MODEL` | gpt-4o | Model for analysis |
| `CONFIDENCE_THRESHOLD` | 0.50 | Min confidence to show findings |
| `MAX_UPLOAD_FILE_SIZE` | 104857600 | Max upload size in bytes |

### Frontend Configuration (`.env.local`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | http://localhost:8000 | Backend API URL |
| `NEXT_PUBLIC_APP_ENVIRONMENT` | development | Environment name |

---

## Troubleshooting

### Docker Issues

**Problem: "Port already in use"**
```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

**Problem: "Cannot connect to database"**
```bash
# Check PostgreSQL container is running
docker-compose ps

# View logs
docker-compose logs postgres

# Verify database exists
docker-compose exec postgres psql -U postgres -l
```

**Problem: "Out of disk space"**
```bash
# Clean up Docker
docker system prune -a

# Remove large volumes
docker volume rm postgres_data elasticsearch_data
```

---

### Backend Issues

**Problem: "ModuleNotFoundError"**
```bash
# Verify virtual environment is activated
which python  # Should show venv path

# Reinstall dependencies
pip install -r requirements.txt
```

**Problem: "Database connection failed"**
```bash
# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check PostgreSQL is running
sudo systemctl status postgresql
```

**Problem: "Reasoning API error"**
```bash
# Verify API key is set
echo $REASONING_API_KEY

# Test API key
echo $REASONING_PROVIDER
```

---

### Frontend Issues

**Problem: "Cannot fetch from API"**
```bash
# Check API URL is correct in .env.local
cat .env.local | grep NEXT_PUBLIC_API_URL

# Verify backend is running
curl http://localhost:8000/docs
```

**Problem: "npm install fails"**
```bash
# Clear cache
npm cache clean --force

# Reinstall
rm -rf node_modules package-lock.json
npm install
```

---

### Performance Issues

**Problem: "Slow contract analysis"**
- Use a faster provider/model pairing for lower latency
- Enable caching: Make sure Redis is running
- Check CPU usage: `top` or Docker dashboard

**Problem: "High memory usage"**
```bash
# Limit backend memory
docker-compose exec backend free -h

# Restart services
docker-compose restart

# Check for memory leaks in logs
docker-compose logs backend | grep memory
```

---

## Next Steps

1. **Create Test Contract:** Use a sample contract to test
2. **Explore API:** Visit http://localhost:8000/docs
3. **Read Documentation:** Check [docs/](../docs/)
4. **Join Community:** GitHub Discussions
5. **Report Issues:** GitHub Issues

---

## Getting Help

- 📖 **Documentation:** [docs/](../docs/)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/yourusername/ai-contract-risk-analyzer/discussions)
- 🐛 **Issues:** [GitHub Issues](https://github.com/yourusername/ai-contract-risk-analyzer/issues)
- 📧 **Email:** support@example.com


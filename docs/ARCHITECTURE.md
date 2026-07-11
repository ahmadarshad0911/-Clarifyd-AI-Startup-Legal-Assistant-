# Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Microservices](#microservices)
4. [Data Layer](#data-layer)
5. [AI Pipeline](#ai-pipeline)
6. [Security Architecture](#security-architecture)
7. [Scalability Design](#scalability-design)
8. [Deployment Topology](#deployment-topology)

---

## System Overview

The AI Contract Risk Analyzer is a **production-grade SaaS platform** built with modern, scalable technologies. The system is designed for:

- **High Availability:** 99.9% uptime SLA with multi-region failover
- **Scalability:** Handle millions of contracts and thousands of concurrent users
- **Security:** SOC 2, GDPR, HIPAA compliant with encryption at rest/in transit
- **Reliability:** Multi-pass validation to minimize AI hallucinations
- **Transparency:** Full audit trails and explainable AI decisions

---

## High-Level Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CDN (CloudFront)                     │
│              Static Assets, Images, Optimized JS            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                            │
│  Next.js 14 (React 18 + TypeScript) on Vercel               │
│                                                              │
│  • Contract Upload UI                                      │
│  • Risk Dashboard                                          │
│  • Collaboration Console                                  │
│  • Analytics & Reports                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS/REST
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway & Load Balancer                │
│      AWS ELB / Kong / Nginx                               │
│  • Authentication (JWT/OAuth 2.0)                         │
│  • Rate Limiting (1000 req/min per API key)              │
│  • Request Routing & Load Balancing                       │
│  • WAF & DDoS Protection                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services                         │
│        FastAPI + Uvicorn on Kubernetes (EKS/GKE)         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Auth Service (JWT validation, SAML, MFA)         │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Contract Service                                   │   │
│  │ • File upload & validation                        │   │
│  │ • OCR text extraction (Tesseract/AWS Textract)   │   │
│  │ • Version management                             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Analysis Service (AI Pipeline)                     │   │
│  │ • Multi-pass validation orchestration             │   │
│  │ • Reasoning API calls (OpenAI/Kimi)              │   │
│  │ • Confidence scoring & validation                │   │
│  │ • Hallucination prevention                       │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Collaboration Service                              │   │
│  │ • Comments, @mentions, approve workflows         │   │
│  │ • WebSocket for real-time updates               │   │
│  │ • Notification dispatch                          │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Integration Service                                │   │
│  │ • REST API gateway & rate limiting               │   │
│  │ • Webhook event dispatching                      │   │
│  │ • OAuth provider for third-party apps           │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Audit Logger Service                               │   │
│  │ • Immutable action logging                        │   │
│  │ • Compliance audit trail query                    │   │
│  │ • Log export (CSV/JSON)                          │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Search Service                                      │   │
│  │ • Elasticsearch indexing                          │   │
│  │ • Full-text contract search                      │   │
│  │ • Faceted navigation                             │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        ↓ Internal APIs    ↓ Async Jobs      ↓ External APIs
┌──────────────────────┐   ┌──────────────┐   ┌─────────────┐
│  Data Layer          │   │ Job Queue    │   │ LLM APIs    │
│                      │   │ (Celery      │   │ (OpenAI,    │
│ - PostgreSQL DB      │   │  + Redis)    │   │  Kimi)      │
│ - Redis Cache        │   │              │   │             │
│ - Elasticsearch      │   │ Workers:     │   └─────────────┘
│ - S3/GCS Storage     │   │ - Extract    │
│ - Vault (secrets)    │   │ - Analyze    │   ┌─────────────┐
└──────────────────────┘   │ - Audit      │   │ Monitoring  │
                           │ - Export     │   │ - DataDog   │
                           │ - Notify     │   │ - PagerDuty │
                           └──────────────┘   └─────────────┘
```

---

## Microservices

### 1. Auth Service
**Purpose:** Handle authentication, authorization, and session management

**Technologies:** FastAPI + Keycloak/Auth0 + JWT + MFA + SAML

**Endpoints:**
- `POST /auth/login` — User login (email/password)
- `POST /auth/refresh` — Refresh JWT token
- `POST /auth/logout` — User logout
- `GET /auth/me` — Current user profile
- `POST /auth/mfa/setup` — Enable 2FA
- `POST /auth/sso/callback` — SAML/OAuth callback

**Key Features:**
- JWT-based authentication
- SAML 2.0 and OAuth 2.0 support
- MFA enforcement (TOTP/SMS)
- Session management with Redis
- Rate limiting on login attempts

---

### 2. Contract Service
**Purpose:** Handle contract upload, storage, versioning, and retrieval

**Technologies:** FastAPI + SQLAlchemy + S3/GCS + Celery

**Endpoints:**
- `POST /contracts/upload` — Upload single or batch contracts
- `GET /contracts/{id}` — Retrieve contract details
- `GET /contracts` — List contracts with filtering
- `PUT /contracts/{id}` — Update contract metadata
- `DELETE /contracts/{id}` — Delete contract
- `POST /contracts/{id}/versions` — Upload new version

**Data Flow:**
```
1. User uploads file (PDF/DOCX)
   ↓
2. File validation (virus scanning, format check)
   ↓
3. Upload to S3 with encryption
   ↓
4. Trigger extraction worker (async)
   ↓
5. OCR text extraction (if scanned PDF)
   ↓
6. Store normalized text in PostgreSQL
   ↓
7. Trigger analysis pipeline
```

**Key Features:**
- Multi-format support (PDF, DOCX, TXT)
- Virus scanning (ClamAV)
- Automatic OCR for scanned documents
- Version control with diff tracking
- File encryption at rest (AES-256)

---

### 3. Analysis Service
**Purpose:** Execute the AI pipeline for contract risk analysis

**Technologies:** FastAPI + provider API client (OpenAI/Kimi) + Celery + Redis

**Three-Pass Analysis Pipeline:**

```
CONTRACT INPUT
    ↓
PASS 1: CLAUSE EXTRACTION
  • GPT-4o: Extract all clauses
  • Parse JSON response
  • Validate clause boundaries
  • Confidence scoring for extraction
  Storage: PostgreSQL clauses table
    ↓
PASS 2: RISK ANALYSIS
  • Per-clause risk scoring (1-10)
  • Multi-dimensional analysis (financial, legal, compliance, operational, strategic)
  • Generate plain-English explanations
  • Identify inter-clause conflicts
  Storage: PostgreSQL clause_risks table
    ↓
PASS 3: ADVERSARIAL AUDIT
  • Re-analyze with alternative prompts
  • Cross-check findings
  • Identify missed risks
  • Validate confidence scores
  • Flag contradictions
  Storage: PostgreSQL audit_results table
    ↓
AGGREGATE & VALIDATE
  • Contract-level risk score calculation
  • Confidence adjustment based on multi-pass agreement
  • Store final results
    ↓
OUTPUT: Contract analysis with risks, confidence, explanations
```

**Key Features:**
- Multi-pass validation (extract → analyze → audit)
- Confidence-based scoring (0-100%)
- Hallucination detection and mitigation
- Critical clause enforcement (liability, IP, confidentiality always shown)
- Structured JSON prompts to prevent invalid outputs
- Result caching for re-analysis requests

---

### 4. Collaboration Service
**Purpose:** Enable team collaboration, comments, and approval workflows

**Technologies:** FastAPI + WebSockets + Redis + PostgreSQL

**Endpoints:**
- `POST /contracts/{id}/comments` — Add comment to clause
- `GET /contracts/{id}/comments` — Get all comments
- `POST /comments/{id}/reactions` — React to comment (@mention, etc.)
- `PUT /contracts/{id}/status` — Update review status
- `POST /workflows` — Create approval workflow
- `GET /workflows/{id}/status` — Check workflow progress

**Real-time Features:**
- WebSocket subscriptions for live updates
- Notification dispatch (email, Slack, Teams)
- @mention resolution and notifications
- Activity feed (who viewed/commented/approved)

**Key Features:**
- Thread-based discussions
- @mention capability with notifications
- Permission-based visibility (viewer/commenter/editor/admin)
- Audit trail of all edits
- Approval workflows with routing

---

### 5. Integration Service
**Purpose:** Provide API gateway, webhooks, and third-party integrations

**Technologies:** FastAPI + OAuth 2.0 + Webhook framework + Zapier/Make integration

**Endpoints:**
- `GET /api/v1/contracts` — REST API to list contracts
- `POST /api/v1/contracts/{id}/analyze` — Trigger analysis via API
- `POST /webhooks` — Subscribe to events
- `DELETE /webhooks/{id}` — Unsubscribe from webhook
- `POST /integrations/{provider}/connect` — OAuth setup

**Webhook Events:**
- `contract.uploaded`
- `contract.analysis_complete`
- `contract.risk_updated`
- `comment.added`
- `workflow.completed`

**Key Features:**
- Rate limiting per API key (1000 req/min default)
- API key rotation and management
- Webhook signature verification (HMAC-SHA256)
- Async result notification
- Webhooks with retry logic and backoff

---

### 6. Audit Logger Service
**Purpose:** Maintain immutable audit logs for compliance

**Technologies:** FastAPI + PostgreSQL + pgaudit + Vault

**Endpoints:**
- `GET /audit-logs` — Query audit logs
- `GET /audit-logs/export` — Export audit report (CSV/JSON)
- `POST /audit-logs/archive` — Archive old logs

**Logged Actions:**
- `upload` — Contract uploaded
- `view` — Contract viewed
- `analyze` — Analysis triggered
- `comment` — Comment added
- `approve` — Contract approved
- `export` — Results exported
- `delete` — Contract deleted
- `permission_change` — Permission updated

**Key Features:**
- Immutable logging (append-only)
- Tamper-evident logs (cryptographic signing)
- Full context logging (who, what, when, where, why)
- Long-term retention (7+ years)
- Compliance reporting (SOX, GDPR, HIPAA)
- Performance: No impact on main operations (async logging)

---

### 7. Search Service
**Purpose:** Enable full-text search and analytics

**Technologies:** FastAPI + Elasticsearch + Redis

**Endpoints:**
- `GET /search` — Full-text contract search
- `GET /search/aggregations` — Risk distribution, trends
- `POST /search/advanced` — Complex queries (date ranges, filters)

**Indexed Fields:**
- Contract file name, extracted text, risk scores, clauses, tags, metadata
- Clause type, risk level, confidence score
- User names, comments, approval status
- Organization metadata

**Key Features:**
- Real-time indexing (async)
- Faceted search (by risk level, clause type, etc.)
- Aggregations and analytics
- Auto-complete for tags
- Performance: < 2 sec search across millions of documents

---

## Data Layer

### Primary Database: PostgreSQL

**Key Tables:**
- `users` — User accounts and profiles
- `organizations` — Tenant data
- `contracts` — Contract metadata
- `clauses` — Extracted clauses with positions
- `clause_risks` — Per-clause risk analysis
- `comments` — Team collaboration/comments
- `audit_logs` — Immutable action log
- `api_keys` — API access credentials
- `batch_jobs` — Background batch processing

**Connection Pooling:**
- PgBouncer for connection management
- Max connections: 1000 (main), 200 (read replicas)
- Connection timeout: 30 seconds
- Idle timeout: 10 minutes

**Replication:**
- Primary + 2 read replicas (different AZs)
- Streaming replication with failover
- RTO (Recovery Time Objective): < 15 min
- RPO (Recovery Point Objective): < 1 min

---

### Cache Layer: Redis

**Purpose:** Session store, rate limiting cache, analysis result caching

**Key Cache Keys:**
- `session:{session_id}` → User session data
- `contract:{id}:analysis` → Analysis results (24h TTL)
- `org:{org_id}:config` → Organization configuration (1h TTL)
- `rate_limit:{api_key}` → API rate limit counter (1 min TTL)
- `batch:{batch_id}:status` → Batch job progress (12h TTL)

**Configuration:**
- Cluster: 3-node Redis Cluster (for high availability)
- Eviction policy: LRU (keep hot data)
- Persistence: RDB + AOF hybrid
- Backup: Hourly snapshots to S3

---

### Search Index: Elasticsearch

**Index Settings:**
- Shards: 5 (for scalability)
- Replicas: 2 (for availability)
- Refresh interval: 5 seconds
- TTL: 5 years (automatic deletion)

**Mappings:**
- `contract_id` (keyword) — Exact matching
- `extracted_text` (text) — Full-text search
- `risk_score` (float) — Numeric filtering
- `clause_type` (keyword) — Faceted search
- `created_at` (date) — Date range filtering

---

### Object Storage: S3/GCS

**Purpose:** Store encrypted contract files with versioning

**Configuration:**
- Versioning: Enabled (keep all versions)
- Encryption: AES-256 at rest, customer-managed keys
- Lifecycle policies: Move to Glacier after 1 year
- Bucket replication: Multi-region for disaster recovery
- Security: Bucket policies, VPC endpoints, no public access

**Folder Structure:**
```
s3://contract-analyzer-prod/
├── contracts/
│   ├── org_{org_id}/
│   │   ├── {contract_id}/
│   │   │   ├── original.pdf
│   │   │   ├── extracted_text.txt
│   │   │   └── versions/
│   │   │       ├── v1.pdf
│   │   │       ├── v2.pdf
```

---

## AI Pipeline

### Hallucination Prevention Mechanisms

1. **Structured Output Formats**
   - All AI outputs marshalled to JSON schema (Pydantic models)
   - Validation of response structure before use
   - Type checking on all fields

2. **Few-Shot Prompting**
   - Include 3–5 examples in every prompt
   - Examples show desired output format and tone
   - Prevents model drift from expected behavior

3. **Temperature Tuning**
   - Extraction (Pass 1): temperature=0.1 (deterministic)
   - Analysis (Pass 2): temperature=0.3 (consistent with detail)
   - Audit (Pass 3): temperature=0.5 (catch edge cases)
   - Suggestions: temperature=0.7 (creative alternatives)

4. **Multi-Pass Validation**
   - Each finding must appear in at least 2 of 3 passes
   - Cross-pass consensus increases confidence
   - Contradictions flagged for human review
   - Confidence multiplier: 1.2x if found in all 3 passes

5. **Confidence Scoring**
   - Base score from LLM token probability
   - Adjusted for consistency across passes
   - Adjusted for clause clarity and industry prevalence
   - Findings < 50% confidence not displayed (unless critical)

6. **Critical Clause Enforcement**
   - Liability, indemnity, IP, confidentiality ALWAYS shown
   - Never filtered out by confidence score
   - Always flagged for human review
   - Extra validation passes for critical clauses

7. **Domain Constraints in Prompts**
   - Prompt specifies valid clause types (30 known categories)
   - Instruction: "Don't invent new clause types"
   - Length limits: "Explanation max 200 words"
   - Invalid response triggers retry with clarification

### Prompt Templates

**Extraction Prompt:**
```
You are a contract analyst. Extract all distinct clauses from this contract.

CLAUSE TYPES (limit to these):
1. Payment Terms    2. Termination Clause    3. Liability
... [complete list]

Return ONLY valid JSON (no markdown, no extra text):
{
  "clauses": [
    {
      "type": "[one of the 30 types]",
      "text": "[exact text from contract]",
      "start_pos": 1234,
      "end_pos": 2345,
      "confidence": 0.92
    }
  ]
}

[CONTRACT TEXT]
```

**Risk Analysis Prompt:**
```
Analyze this clause for legal risk. Context: [type of contract], [industry].

Industry standard for this clause type: [reference language]

Clause: [clause text]

Return ONLY valid JSON:
{
  "risk_score": 1-10,
  "severity": "Critical|High|Medium|Low",
  "explanation": "[2-3 sentences in plain English]",
  "safe_alternative": "[suggested language]",
  "confidence": 0.85
}
```

---

## Security Architecture

### Authentication & Authorization

```
USER LOGIN
  ↓
1. Email/Password Auth or OAuth 2.0/SAML
  ↓
2. MFA Validation (TOTP or SMS)
  ↓
3. Issue JWT Token
  ↓
4. JWT in Authorization header for all API calls
  ↓
5. API Gateway validates JWT signature + expiration
  ↓
6. Role-Based Access Control (RBAC)
   ├── Admin: Full access
   ├── Editor: Create/edit contracts, approve
   ├── Commenter: View, add comments
   └── Viewer: Read-only access
  ↓
7. Attribute-Based Access Control (ABAC)
   ├── Resource ownership checks
   ├── Organization isolation (multi-tenancy)
   ├── Data classification enforcement
  ↓
ACCESS GRANTED/DENIED
```

### Data Encryption

**At Rest:**
- Database: Encrypted PostgreSQL database
- Storage: AES-256 encryption (S3/GCS)
- Backups: Encrypted snapshots, key in Vault
- Keys: Hardware Security Module (HSM)

**In Transit:**
- TLS 1.3 for all traffic
- Perfect forward secrecy (ECDHE)
- Certificate pinning for critical APIs
- No plaintext communications

### Network Security

```
┌─────────────────────────────────────┐
│  CloudFlare / AWS Shield            │
│  - DDoS protection                  │
│  - WAF rules                        │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  API Gateway (Kong / AWS API GW)    │
│  - Rate limiting                    │
│  - JWT validation                   │
│  - Request signing                  │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  VPC (Private Network)              │
│  - No public IP for services        │
│  - VPC endpoints for AWS services   │
│  - Network ACLs and security groups │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  K8s cluster (private)              │
│  - Pod security policies            │
│  - Network policies                 │
│  - RBAC for cluster access          │
└─────────────────────────────────────┘
```

### Compliance Controls

- **SOC 2 Type II:** Audited annual reports
- **GDPR:** Data processing agreements, DPA with processors
- **HIPAA:** BAA available, encrypted healthcare data
- **ISO 27001:** Information security management
- **Penetration testing:** Quarterly third-party assessments
- **Vulnerability scanning:** Daily automated scans

---

## Scalability Design

### Horizontal Scaling

**Frontend:**
- Deployed to Vercel (edge computing, auto-scaling)
- Edge functions in 300+ data centers globally
- Automatic scaling based on traffic

**Backend:**
- Kubernetes cluster with Horizontal Pod Autoscaler (HPA)
- Scale API pods 1-100+ based on CPU/memory
- Scale Celery workers based on queue depth
- Load balancing across availability zones

**Database:**
- Connection pooling (PgBouncer)
- Read replicas for read-heavy workloads
- Data sharding by organization (multi-tenancy)
- Partitioned tables for audit logs (by date)

**Cache & Search:**
- Redis cluster (3+ nodes)
- Elasticsearch cluster (5+ nodes)
- Auto-scaling based on memory/disk

### Performance Optimization

| Layer | Optimization |
|-------|--------------|
| **Frontend** | Code splitting, lazy loading, service workers |
| **API** | Response compression (gzip), pagination, caching headers |
| **Database** | Query optimization, indexing, materialized views |
| **Search** | Elasticsearch aggregations, filter caching |
| **Storage** | S3 accelerated transfer, CloudFront CDN |

### Cost Scaling

| Metric | Formula | Example |
|--------|---------|---------|
| **LLM Cost** | $0.15 per contract | 10k contracts/mo = $1,500 |
| **Infra Cost** | $0.02 per contract | 10k contracts/mo = $200 |
| **Storage Cost** | $0.01 per contract | 10k contracts/mo = $100 |
| **Fixed Cost** | ~$5k-10k per month | Engineering, support |
| **Total Cost per Contract** | ~$0.18 | For unit economics |

---

## Deployment Topology

### Development Environment
```
docker-compose.dev.yml
├── frontend (Next.js, http://localhost:3000)
├── backend (FastAPI, http://localhost:8000)
├── postgres-dev
├── redis-dev
└── elasticsearch-dev
```

### Staging Environment
```
AWS EKS Cluster (1 AZ)
├── Frontend: 2 replicas on Vercel
├── Backend: 3 API pods
├── Workers: 5 Celery pods
├── Database: PostgreSQL + read replica
├── Cache: Redis (2 nodes)
└── Search: Elasticsearch (2 nodes)
```

### Production Environment
```
AWS Multi-Region (us-east-1 primary, eu-west-1 secondary)
├── Primary Region (us-east-1):
│   ├── Frontend: Vercel Edge (global CDN)
│   ├── Backend K8s: Auto-scaling 5-50 pods
│   ├── Workers: Auto-scaling 10-100 pods
│   ├── Database: Primary PostgreSQL + 2 read replicas
│   ├── Cache: Redis cluster (3 nodes)
│   ├── Search: Elasticsearch cluster (5 nodes)
│   └── Storage: S3 with versioning, replication
│
├── Secondary Region (eu-west-1):
│   ├── Read-only replicas
│   ├── Warm standby for failover
│   └── Cross-region replication
│
└── Observability:
    ├── Prometheus + Grafana (metrics)
    ├── ELK Stack (logs)
    ├── Jaeger (distributed tracing)
    ├── DataDog (APM)
    └── PagerDuty (incident management)
```

---

## Key Architectural Decisions

### Why Microservices?
- Enables independent scaling of services
- Fault isolation (one service down doesn't affect others)
- Technology diversity (use best tool for each service)
- Easier testing and deployment

### Why FastAPI?
- High performance (comparable to Go/Rust for typical workloads)
- Native async/await support (perfect for I/O-bound contract processing)
- Built-in OpenAPI/Swagger documentation
- Type safety with Pydantic models
- Growing ecosystem and community

### Why PostgreSQL?
- ACID guarantees (critical for financial contracts)
- Rich query language (complex risk analysis queries)
- Mature, production-tested database
- Great scaling options (replication, sharding)
- Superior JSON support

### Why Kubernetes?
- Industry standard for container orchestration
- Built-in auto-scaling and self-healing
- Multi-region deployment support
- Mature ecosystem and tooling
- Cost-efficient resource utilization

---

## Additional Resources

- [Deployment Guide](./DEPLOYMENT.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Security & Compliance](./SECURITY.md)
- [Testing Strategy](./TESTING.md)

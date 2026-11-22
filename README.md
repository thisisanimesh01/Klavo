# Klavo — Modern Collaborative Project Management Platform

Klavo is a full-stack, enterprise-ready project management, team collaboration, automation, and real-time document workspace built for modern software and product engineering teams.

---

## 🌟 Key Capabilities & Architectural Pillars

1. **Agile Project Management**:
   - Customizable Kanban workflows with WIP limits, sprint lifecycle planning, and milestone tracking.
   - Granular priorities, custom labels, custom fields, checklist management, and dependencies.
2. **Real-Time Collaboration**:
   - Collaborative rich-text document editing powered by **Yjs CRDTs** with deterministic P2P/cluster convergence.
   - Presence tracking, live cursor movement, active viewer detection, mentions, comments, and project wikis.
3. **AI-Assisted Engineering**:
   - Natural language task extraction, automated breakdown into subtasks and acceptance criteria.
   - Project velocity estimation, risk/blocker detection, and automated task prioritization.
4. **Integrations & Developer Ecosystem**:
   - Inbound and outbound webhooks with HMAC-SHA256 signatures and automated exponential retry backoff.
   - Scoped public REST APIs with API key authentication (`klv_...`) and rate-limiting.
   - GitHub activity feeds and Slack notification hooks.
5. **Advanced Automation Engine**:
   - Multi-trigger (event, schedule, cron) execution with AND/OR conditional branching.
   - Atomic distributed locking (`DistributedLock`) with TTL failover preventing duplicate execution across multiple server instances.
   - Built-in dry-run simulation mode (`simulateAutomationRule`) and execution history audit logs.
6. **Enterprise Governance & Administration**:
   - Multi-tenant organization hierarchies with custom role matrices and fine-grained capabilities.
   - Cryptographically linked audit logs (`AuditLog`) with SHA-256 block hash chains ensuring tamper detection.
   - SAML 2.0 / OIDC single sign-on assertion parsing and email domain restriction enforcement.
   - Documented SCIM 2.0 directory sync specification hooks.
7. **Production Reliability & Scalability**:
   - Multi-instance support with Redis coordination and zero-downtime MongoDB index migrations.
   - Structured JSON logging, health/readiness endpoints (`/api/health/live`, `/api/health/ready`, `/api/health/metrics`), and non-destructive backup/restore utilities.

---

## 🏗 Technology Stack

- **Backend**: Node.js v20 LTS, Express, Mongoose, Socket.IO, Yjs, Redis, JSON Web Tokens, Crypto.
- **Frontend**: React 18, Vite, Redux Toolkit, Tailwind CSS, Lucide React, Tiptap.
- **Testing**: Node.js Native Test Runner (`node --test`), Playwright E2E.
- **Database**: MongoDB 6.0+ (WiredTiger).

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- MongoDB 6.0+ running on port 27017

### 2. Installation
Clone the repository and install root, backend, and frontend dependencies:
```bash
git clone https://github.com/thisisanimesh01/Klavo.git
cd Klavo

# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Environment Configuration
Create a `.env` file in `backend/` (or copy from `backend/.env.example`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/klavo
JWT_SECRET=your_cryptographically_secure_jwt_secret_32_chars_min
FRONTEND_URL=http://localhost:5173
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=./storage_uploads
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
```

### 4. Running the Development Servers
Start backend and frontend in separate terminals:
```bash
# Terminal 1: Backend API
cd backend
npm run dev

# Terminal 2: Frontend Client
cd frontend
npm run dev
```

Visit `http://localhost:5173` to access the application.

---

## 🧪 Running Tests & Quality Verification

### Run Backend Unit & Integration Tests
```bash
# Runs full test suite (523 tests across models, APIs, and business logic)
node --test backend/tests/*.test.js
```

### Run Frontend Component & Architecture Tests
```bash
# Runs 179 client-side tests
node --test frontend/tests/*.test.js
```

### Run Playwright End-to-End Journeys
```bash
npx playwright test
```

### Run Security & Secret Leak Audits
```bash
# Scans tracked repository files for exposed credentials or secrets
node scripts/scan_secrets.js
```

### Run Production Readiness & Preflight Verification
```bash
node backend/src/utils/preflightCheck.js --skip-db
```

### Run Live Database Index Migrations
```bash
# Dry-run inspection
node backend/src/utils/indexMigration.js --dry-run

# Live index synchronization
node backend/src/utils/indexMigration.js
```

---

## 📚 Architectural & Operational Documentation

Detailed architecture specifications, security audits, and runbooks are available in `docs/`:
- [`FINAL_RELEASE_AUDIT.md`](docs/FINAL_RELEASE_AUDIT.md) — Comprehensive feature completeness matrix, security findings, owner release blockers, and GO/NO-GO recommendation.
- [`SCALABILITY_RELIABILITY.md`](docs/SCALABILITY_RELIABILITY.md) — High contention benchmarks, distributed locking failover, and chaos recovery procedures.
- [`ENTERPRISE_ARCHITECTURE.md`](docs/ENTERPRISE_ARCHITECTURE.md) — Organization hierarchies, SAML/OIDC SSO, and tamper-resistant audit logs.
- [`AUTOMATION_ARCHITECTURE.md`](docs/AUTOMATION_ARCHITECTURE.md) — Automation rule engine, multi-action dispatch, and loop protection.
- [`COLLABORATION.md`](docs/COLLABORATION.md) — Yjs CRDT synchronization and real-time presence architecture.
- [`AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md) — Prompt sanitization, natural language extraction, and velocity modeling.
- [`INTEGRATIONS_ARCHITECTURE.md`](docs/INTEGRATIONS_ARCHITECTURE.md) — Webhooks, public API security, and signature verification.
- [`MONITORING_AND_RECOVERY.md`](docs/MONITORING_AND_RECOVERY.md) — Health observability endpoints, metrics, and backup/restore drills.

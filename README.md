# Klavo — Modern Collaborative Project Management Platform

Klavo is a full-stack, enterprise-ready project management, team collaboration, automation, and real-time document workspace built for modern software and product engineering teams.

---

## 🌟 Key Capabilities & Architectural Pillars

1. **Authentication & Identity**:
   - Modern, frictionless authentication with **Google Sign-In** and **GitHub OAuth** alongside standard secure email/password registration.
   - Enterprise SAML 2.0 / OIDC single sign-on assertion parsing and email domain restriction enforcement.
2. **Agile Project Management**:
   - Customizable Kanban workflows with WIP limits, sprint lifecycle planning, and milestone tracking.
   - Granular priorities, custom labels, custom fields, checklist management, and dependencies.
3. **Real-Time Collaboration**:
   - Collaborative rich-text document editing powered by **Yjs CRDTs** with deterministic P2P/cluster convergence.
   - Presence tracking, live cursor movement, active viewer detection, mentions, comments, and project wikis.
4. **AI-Assisted Engineering**:
   - Natural language task extraction, automated breakdown into subtasks and acceptance criteria.
   - Project velocity estimation, risk/blocker detection, and automated task prioritization.
5. **Integrations & Developer Ecosystem**:
   - Inbound and outbound webhooks with HMAC-SHA256 signatures and automated exponential retry backoff.
   - Scoped public REST APIs with API key authentication (`klv_...`) and rate-limiting.
   - GitHub activity feeds and Slack notification hooks.
6. **Advanced Automation Engine**:
   - Multi-trigger (event, schedule, cron) execution with AND/OR conditional branching.
   - Atomic distributed locking (`DistributedLock`) with TTL failover preventing duplicate execution across multiple server instances.
   - Built-in dry-run simulation mode (`simulateAutomationRule`) and execution history audit logs.
7. **Enterprise Governance & Administration**:
   - Multi-tenant organization hierarchies with custom role matrices and fine-grained capabilities.
   - Cryptographically linked audit logs (`AuditLog`) with SHA-256 block hash chains ensuring tamper detection.
   - Documented SCIM 2.0 directory sync specification hooks.
8. **Production Reliability & Scalability**:
   - Multi-instance support with Redis coordination and zero-downtime MongoDB index migrations.
   - Structured JSON logging, health/readiness endpoints (`/api/health/live`, `/api/health/ready`, `/api/health/metrics`), and non-destructive backup/restore utilities.

---

## 🏗 Technology Stack

- **Backend**: Node.js v20 LTS, Express, Mongoose, Socket.IO, Yjs, Redis, JSON Web Tokens, Crypto, Native Fetch OAuth.
- **Frontend**: React 18, Vite, Redux Toolkit, Tailwind CSS, Lucide React, Tiptap, `@react-oauth/google`.
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

#### Backend Configuration (`backend/.env`):
Create `backend/.env` (or copy from `backend/.env.example`):
```env
PORT=5050
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/klavo
JWT_SECRET=your_cryptographically_secure_jwt_secret_32_chars_min
FRONTEND_URL=http://localhost:5173
STORAGE_PROVIDER=local

# OAuth Settings (Optional: Enables Google and GitHub Sign-In)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

#### Frontend Configuration (`frontend/.env`):
Create `frontend/.env` (or copy from `frontend/.env.example`):
```env
VITE_API_URL=http://localhost:5050/api
VITE_BACKEND_URL=http://localhost:5050

# OAuth Client IDs for Web Browser Login
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_GITHUB_CLIENT_ID=your_github_client_id
```

### 4. Running the Development Servers
Start backend and frontend in separate terminals:
```bash
# Terminal 1: Backend API & Socket Server
cd backend
npm run dev

# Terminal 2: Frontend Client (Vite Dev Server)
cd frontend
npm run dev
```

Visit `http://localhost:5173` to access the application.

---

## 🔐 OAuth Setup Guide

### Google Sign-In
1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Web Client ID**.
3. Add `http://localhost:5173` to **Authorized JavaScript origins**.
4. Set `VITE_GOOGLE_CLIENT_ID` in `frontend/.env` and `GOOGLE_CLIENT_ID` in `backend/.env`.

### GitHub OAuth
1. Go to GitHub [Developer Settings → OAuth Apps](https://github.com/settings/developers).
2. Register a new OAuth application with:
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: `http://localhost:5173/auth/github/callback`
3. Generate a Client Secret.
4. Set `VITE_GITHUB_CLIENT_ID` in `frontend/.env` and `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` in `backend/.env`.

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

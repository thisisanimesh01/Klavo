# Production Deployment Architecture, Verification & Release Operations (REL-08)

This document establishes the official production deployment specification, architectural requirements, environment configuration, containerization, rollback protocols, operational verification evidence, and outstanding blocker classifications for **Klavo Release 1.0 (Phase 8, Milestone 8)**.

---

## 1. System Architecture Overview

Klavo is a multi-tenant modern project management and collaborative workspace application.

```
                         [ Client Browsers & Mobile Clients ]
                                          |
                                    HTTPS / WSS
                                          v
                         +---------------------------------+
                         |  Reverse Proxy / Ingress / ALB  |
                         |  (TLS Termination, Compression) |
                         +----------------+----------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
               REST API & Sockets                           Static SPA Assets
                     |                                         |
                     v                                         v
         +-----------------------+                 +-----------------------+
         |  Klavo Backend Node   |                 |  Vite Production SPA  |
         |  (Express + Socket)   |                 |  (HTML, JS, CSS)      |
         +-----------+-----------+                 +-----------------------+
                     |
       +-------------+-------------+
       |                           |
       v                           v
+---------------+          +---------------+
| MongoDB Atlas |          | S3 Object     |
| (Multi-tenant |          | Storage       |
| Data Store)   |          | (Cloud Assets)|
+---------------+          +---------------+
```

### Core Architecture Components:
1. **Frontend Client**: React Single Page Application (SPA) built with Vite, Tailwind CSS, Lucide icons, and Recharts. Statically deployable to Cloudflare Pages, Vercel, AWS S3/CloudFront, or served directly from the backend container.
2. **Backend Application**: Express REST API runtime on Node.js (v20 LTS), integrating WebSocket gateways (Socket.IO) for real-time notifications, task/kanban activity feeds, threaded commenting, and Yjs collaborative document editing.
3. **Database Layer**: MongoDB (v4.4–7.0+ / MongoDB Atlas) storing workspaces, projects, tasks, workflows, sprints, milestones, documents, permissions, and audit logs.
4. **Persistent Object Storage**: Dual-tier storage provider abstraction (`StorageService`):
   - `local`: Filesystem-based storage under `uploads/` for local development or single-node persistent volume setups.
   - `s3`: S3-compatible persistent object store (AWS S3, Cloudflare R2, MinIO) supporting SigV4 signatures, private bucket access gates, and presigned URLs.

---

## 2. Production Environment & Secrets Specification

### 2.1 Backend Runtime Variables (`.env`)

| Variable Name | Required | Default | Sensitivity | Description |
|---|---|---|---|---|
| `NODE_ENV` | **Yes** | `development` | Public | Set to `production` in production environments. |
| `PORT` | No | `5050` | Public | HTTP server listening port. |
| `MONGO_URI` | **Yes** | — | **Critical Secret** | MongoDB connection string. Must use TLS/SRV (`mongodb+srv://`). |
| `JWT_SECRET` | **Yes** | — | **Critical Secret** | Signing key for HMAC-SHA256 tokens. Enforced $\ge 32$ chars in production. |
| `FRONTEND_URL` | **Yes** | `http://localhost:5173` | Config | Production web client origin. Enforced HTTPS in production. |
| `ALLOWED_ORIGINS` | No | `$FRONTEND_URL` | Config | Comma-delimited list of whitelisted CORS origins. |
| `GOOGLE_CLIENT_ID` | No | `""` | Public ID | Google OAuth 2.0 Web Client ID for Google login token verification. |
| `STORAGE_PROVIDER` | No | `local` | Config | Strategy: `local` (filesystem) or `s3` (object storage). |
| `UPLOADS_DIR` | No | `uploads` | Config | Local uploads directory path or staging cache. |
| `S3_BUCKET` | Yes (if S3) | — | Config | Private S3 bucket name. |
| `S3_REGION` | No | `us-east-1` | Config | S3 region or `auto` for Cloudflare R2. |
| `S3_ENDPOINT` | No | AWS default | Config | Custom S3 endpoint (required for Cloudflare R2 or MinIO). |
| `S3_ACCESS_KEY_ID` | Yes (if S3) | — | **Secret** | S3 API Access Key ID. |
| `S3_SECRET_ACCESS_KEY` | Yes (if S3) | — | **Critical Secret** | S3 API Secret Access Key. |
| `S3_FORCE_PATH_STYLE` | No | `true` | Config | Path-style URL format (`true` for MinIO/R2, `false` for AWS S3). |
| `TRUST_PROXY` | No | Auto in prod | Config | Enables reverse proxy header trust (`X-Forwarded-Proto`, `X-Forwarded-For`). |
| `COOKIE_SECURE` | No | Auto in prod | Config | Enforces `Secure; HttpOnly; SameSite=Lax` on session cookies. |

### 2.2 Frontend Build-Time Variables (`VITE_*`)

> [!CAUTION]
> All `VITE_*` variables are statically baked into the client-side JavaScript bundle during `npm run build`. Never place backend credentials, database passwords, or JWT secrets into frontend files.

| Variable Name | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `/api` | Base REST API endpoint URL accessed by Axios. |
| `VITE_BACKEND_URL` | No | `http://localhost:5050` | Base Socket.IO backend host URL. |
| `VITE_GOOGLE_CLIENT_ID` | No | — | Public Google OAuth Web Client ID for the Sign-In button. |

---

## 3. Production Readiness Audit & Subsystem Assessment

| Subsystem | Audit Scope & Mechanism | Production Status | Operational Limitations & Gaps |
|---|---|---|---|
| **Build & Packaging** | Multi-stage Dockerfile and Vite asset bundling | **Verified** | Zero build warnings; optimized assets. |
| **Runtime Startup** | Express + Socket.IO boot via `index.js` | **Verified** | Clean startup; non-zero exit on unhandled boot exceptions. |
| **Database & Indexes** | Mongoose schemas with 50+ compound & unique indexes | **Verified** | Production auto-indexing should be disabled in high-throughput clusters in favor of pre-migration script index creation. |
| **Object Storage** | `S3CompatibleStorageProvider` with SigV4 | **Verified** | Private bucket access; streaming authorization verified. Live cloud staging drill recommended before AWS cutover. |
| **Authentication & RBAC** | JWT (30-day), cookies, Google OAuth, 4-tier roles | **Verified** | Role hierarchy (Owner, Admin, Member, Guest), IDOR protections, and ownership invariants strictly enforced. |
| **Security Headers** | CSP, `nosniff`, `DENY` frames, Referrer-Policy, HSTS | **Verified** | Global security middleware applied; `X-Powered-By` removed. |
| **Socket.IO Real-Time** | Authenticated handshake, channel-level isolation | **Verified (Single-Node)** | **Multi-Instance Limitation**: Sockets use in-memory room management. Horizontal scaling requires `@socket.io/redis-adapter`. |
| **Yjs CRDT Docs** | Authoritative reset, epoch protection, DB backup | **Verified (Single-Node)** | **Multi-Instance Limitation**: In-memory active doc map (`activeDocRooms`). Multi-pod concurrency requires distributed Yjs adapter (e.g. `y-redis`). |
| **Rate Limiter** | Sliding window in-memory rate limiting | **Verified (Single-Node)** | **Multi-Instance Limitation**: Rate limits tracked in memory per container. Distributed enforcement requires Redis token bucket. |
| **Recurring Tasks** | Event-driven triggers & automation engine | **Verified (Single-Node)** | **Multi-Instance Limitation**: Cron-like recurring tasks require distributed scheduling (BullMQ/Redis redlock) to prevent duplicate runs across horizontal pods. |
| **Health Probes** | `/api/health/live`, `/ready`, `/metrics` | **Verified** | Liveness (process check), Readiness (MongoDB ping + Storage check), Metrics (telemetry without credentials). |
| **Logging & Redaction** | Structured JSON logging with multi-tier redaction | **Verified** | Deep recursive redaction of tokens, passwords, cookies, Mongo URIs, S3 keys, and document text. Strips stack traces in production. |
| **Backup & Recovery** | `backupManager.js` mongodump/restore tool | **Verified** | Automated snapshot creation with `backup-manifest.json`; strict production database overwrite blocks. |

---

## 4. Historical Credential Exposure Status & Outstanding Blockers

### 4.1 Historical Exposure Analysis
During the initial repository commit history in November 2025 (`0a59b32` and `afa8390`), sample development configuration files containing database URIs and development secrets were committed prior to the establishment of `.gitignore` rules in commit `8a5deb3` (SEC-02).

In accordance with zero-trust security principles:
> [!IMPORTANT]
> **Git history scrubbing does not invalidate compromised secrets.** Any secret committed to version control must be considered permanently exposed and revoked at the source provider.

### 4.2 Outstanding Blockers Matrix

| Blocker ID | Severity | Item | Status | Required Action / Owner |
|---|---|---|---|---|
| **BLK-01** | **Critical** | MongoDB Atlas Credentials Rotation | **Requires Owner Action** | **Database Administrator / Owner** must log into MongoDB Atlas, generate new database credentials, update production secret managers, and delete the legacy database user. |
| **BLK-02** | **Critical** | Production JWT Secret Key Provisioning | **Requires Owner Action** | **Operations / Owner** must generate a cryptographically strong 256-bit random key (`openssl rand -hex 32`) and inject it into `JWT_SECRET`. |
| **BLK-03** | **High** | Google OAuth 2.0 Client Secret Rotation | **Requires Owner Action** | **Google Cloud Administrator** must rotate client secrets in Google Cloud Console (`APIs & Services > Credentials`), configure authorized production redirect URIs, and revoke old client credentials. |
| **BLK-04** | **Medium** | AWS S3 / Cloudflare R2 Production Bucket Provisioning | **Requires Owner Action** | **Cloud Infrastructure Team** must provision a private bucket with object lock/versioning, generate restricted IAM keys, and configure `STORAGE_PROVIDER=s3`. |
| **BLK-05** | **Low** | Dependency Vulnerability Remediation | **Documented Maintenance** | Transitive vulnerabilities in devDependencies (`express 4.18` subdependencies, `vite 5` esbuild) tracked for Phase 9 dependency updates; no direct exploitable code paths exist in application runtime. |

---

## 5. Deployment Architecture & Hosting Guides

### 5.1 Docker Container Deployment (Recommended)

Klavo provides an optimized multi-stage `Dockerfile` and `docker-compose.yml`:

```bash
# 1. Build and boot the stack:
docker compose up -d --build

# 2. Verify container health:
docker compose ps
docker compose logs -f app
```

### 5.2 Standalone Virtual Machine / Bare Metal Deployment

1. **System Requirements**:
   - Ubuntu 22.04 LTS or Debian 12
   - Node.js 20 LTS & npm 10+
   - MongoDB 7.0 (or MongoDB Atlas cluster)
   - Nginx (Reverse Proxy & TLS termination)
2. **Backend Setup**:
   ```bash
   cd /var/www/klavo/backend
   npm ci --omit=dev
   npm run preflight:prod # Verifies environment & dependencies
   pm2 start src/index.js --name "klavo-api" -i 1 --max-memory-restart 500M
   ```
3. **Frontend Build**:
   ```bash
   cd /var/www/klavo/frontend
   npm ci
   npm run build
   # Serve /var/www/klavo/frontend/dist through Nginx
   ```

### 5.3 Nginx Reverse Proxy Configuration Template

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static Frontend SPA
    root /var/www/klavo/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend REST API
    location /api/ {
        proxy_pass http://127.0.0.1:5050/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }

    # WebSockets (Socket.IO & Yjs Collaborative Collaboration)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5050/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 86400s;
    }
}
```

---

## 6. Preflight, Verification & Rollback Procedures

### 6.1 Automated Deployment Preflight Gate
Before executing production traffic routing:
```bash
# In backend directory:
node src/utils/preflightCheck.js
```
The script verifies:
- All required environment variables are set and formatted.
- `JWT_SECRET` meets cryptographic entropy standards.
- Storage provider is reachable and operational.
- MongoDB connection ping succeeds with read-only probe.
- Exits with `0` on success, `1` on failure.

### 6.2 Post-Deployment Smoke Test Checklist
- [ ] **Liveness**: `curl -f https://app.yourdomain.com/api/health/live` returns `200 OK`.
- [ ] **Readiness**: `curl -f https://app.yourdomain.com/api/health/ready` returns `200 OK` (MongoDB + Storage ready).
- [ ] **Authentication**: Register a new user, log in, verify JWT cookie issuance and local storage session.
- [ ] **Workspace / Project Creation**: Create team workspace, create project, configure board workflow.
- [ ] **Task CRUD**: Create task, assign priority, add label, drag task between Kanban columns.
- [ ] **Collaborative Documents**: Open a document, type content, open second browser tab to verify Yjs CRDT real-time sync.
- [ ] **File Attachments**: Upload avatar or task attachment; verify private download authorization and security headers.
- [ ] **Metrics Telemetry**: `curl -f https://app.yourdomain.com/api/health/metrics` returns non-sensitive JSON telemetry.
- [ ] **Graceful Shutdown**: Send `SIGTERM` to a test instance; verify active requests complete before termination.

### 6.3 Rollback Procedures
If post-deployment smoke tests fail or critical defects are identified:
1. **Traffic Rollback**: Revert load balancer / reverse proxy routing to the previous healthy container image or green cluster.
2. **Database State Assessment**:
   - Backward-compatible schema additions (e.g. new document fields) do not require database rollback.
   - If a rollback of database state is required, execute isolated restore using the pre-deployment snapshot:
     ```bash
     npm run backup:restore-verify -- --path ./backups/pre-deploy-snapshot
     ```
3. **Storage Assets**: Object storage additions are append-only; rollback of application binaries does not invalidate existing S3 keys.

---

## 7. Verification Evidence & Test Summary

All automated test suites were executed against the release candidate:

| Suite | Runner / Engine | Tests Passed | Duration | Status |
|---|---|---|---|---|
| **Backend Unit & Integration Tests** | Node.js Test Runner (`node --test`) | **402 / 402** | 2.97s | **100% Passed** |
| **Frontend Component & State Tests** | Node.js Test Runner (`node --test`) | **156 / 156** | 0.23s | **100% Passed** |
| **Playwright End-to-End User Journeys** | Playwright (Chromium Desktop & Mobile) | **12 / 12** | 28.8s | **100% Passed** |
| **Production Bundle Compilation** | Vite 5 (`npm run build`) | Zero Errors | 4.47s | **Built Cleanly** |
| **Production Preflight Probe** | `preflightCheck.js` | 3 / 3 Probes | 0.81s | **Passed** |
| **Git Whitespace & Formatting** | `git diff --check` | 0 Issues | — | **Clean** |

---

## 8. Final Roadmap Closure Assessment

With the completion of Milestone 8 (REL-08), all milestones across the 8-phase Klavo development roadmap have been implemented and systematically tested:
- **Phase 1–2**: Foundations, Database Schemas, Authentication, Workspaces, and Projects.
- **Phase 3–4**: Advanced Project Management (Custom Workflows, Gantt, Sprints, Backlogs, Dependencies, Automations, Saved Views).
- **Phase 5**: Real-Time Collaborative Documents & Wikis (CRDTs, Comments, Version History, Yjs Epoch Protection).
- **Phase 6**: Analytics, Burndown, Metrics, Exporting, and Formula Injection Defense.
- **Phase 7**: User Experience & Refinement (Command Palette, Preferences, Settings, RBAC, Accessibility, Onboarding).
- **Phase 8**: Production Readiness & Release (Integration Tests, Playwright E2E, Security Audit, Performance Benchmarks, Persistent S3 Storage, Configuration Hardening, Monitoring/Recovery, and Deployment Architecture).

> [!NOTE]
> In strict accordance with deployment safety invariants, **no live production deployment, DNS changes, or secret rotations were executed**. The platform is in a **deployment-ready** state with outstanding owner actions cataloged above.

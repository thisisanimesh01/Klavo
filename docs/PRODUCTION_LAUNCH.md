# Production Launch, Staging Verification & Operational Runbook (REL-14)

This runbook establishes the formal deployment specifications, multi-tier architecture, environment schema, staging verification results, database migration protocols, disaster recovery procedures, incident response contacts, and go/no-go launch checklists for the Klavo platform.

---

## 1. System Architecture & Topology

Klavo follows an isolated, stateless, multi-tier micro-service architecture designed for high availability, zero-trust security boundaries, and horizontal elasticity:

```
                                [ Edge / Reverse Proxy ]
                              (TLS Termination / HTTPS / WAF)
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             [ Web Application Tier ]                    [ WebSocket Cluster ]
           Express REST API / Static SPA                   Socket.IO + Yjs CRDT
           (Node.js 20 LTS Alpine)                         (/socket.io transport)
                       │                                           │
                       ├─────────────────────┬─────────────────────┤
                       ▼                     ▼                     ▼
              [ Shared Coordination ]   [ Object Store ]    [ Persistent Database ]
               Redis 7.2 + TLS (ALPN)   S3-Compatible       MongoDB 7.0 (WiredTiger)
               • Distributed Locks       (SigV4 Streaming,   • Replica Set (w: majority)
               • Socket.IO Adapter        Private ACL)       • autoIndex: false in prod
               • Sliding Rate Limiting                       • Point-in-time Recovery (PITR)
```

### 1.1 Service Responsibilities
1. **Application Cluster**: Stateless Node.js 20 containers running the Express HTTP pipeline and Socket.IO real-time event broker. Static frontend assets are built via multi-stage Docker build and served securely.
2. **Database (MongoDB 7.0+)**: Primary persistence store with replica sets and majority write concern. Automatic background index creation is disabled in production (`autoIndex: false`) to prevent high lock contention during runtime.
3. **Coordination (Redis 7.2+)**: Provides cross-pod atomic locking (`acquireDistributedLock`), Socket.IO Redis pub/sub room broadcasting, sliding-window rate limit counters, and recurring task leader leasing.
4. **Persistent Storage (S3 / Local)**: Files, documents, attachments, and avatars are streamed via AWS S3 / Cloudflare R2 / MinIO with SigV4 authentication and strict path sanitization.

---

## 2. Environment Variables & Secret Configuration Schema

> [!CAUTION]
> **Zero Exposure Guarantee**: Environment variable names are documented below. Secret values, keys, and credentials must **never** be hard-coded or committed into source control.

| Environment Variable | Required in Prod | Valid Formats / Constraints | Description |
|---|:---:|---|---|
| `NODE_ENV` | Yes | `production`, `staging`, `development`, `test` | Target environment execution mode. |
| `PORT` | Yes | Integer (e.g. `5050`) | Port on which the HTTP server listens. |
| `MONGO_URI` | Yes | `mongodb://...` or `mongodb+srv://...` | Connection URI. Must not contain placeholder brackets. |
| `JWT_SECRET` | Yes | High entropy hex string (>= 32 chars) | Cryptographic signing key for HS256 authentication tokens. |
| `FRONTEND_URL` | Yes | `https://app.yourdomain.com` | Base origin of the frontend web application. HTTPS required in prod. |
| `ALLOWED_ORIGINS` | No | Comma-separated HTTPS URLs | Permitted CORS origins for API requests and Socket.IO connections. |
| `STORAGE_PROVIDER` | Yes | `s3` or `local` | Storage provider driver. |
| `UPLOADS_DIR` | No | Filesystem path (default: `uploads`) | Staging directory for multipart upload streams. |
| `S3_BUCKET` | If `STORAGE_PROVIDER=s3` | String identifier | Target cloud object storage bucket name. |
| `S3_REGION` | If `STORAGE_PROVIDER=s3` | AWS Region (e.g. `us-east-1`) | Cloud storage target region. |
| `S3_ACCESS_KEY_ID` | If `STORAGE_PROVIDER=s3` | Alphanumeric access key | IAM credentials with restricted bucket permissions. |
| `S3_SECRET_ACCESS_KEY`| If `STORAGE_PROVIDER=s3` | Cryptographic secret key | IAM secret key. |
| `S3_ENDPOINT` | No | URL (e.g. MinIO or R2 endpoint) | Custom S3-compatible service endpoint. |
| `S3_FORCE_PATH_STYLE` | No | `true` or `false` (default: `true`) | Path-style URL addressing for MinIO/Ceph compatibility. |
| `REDIS_URL` | If `DISTRIBUTED_MODE=true` | `redis://...` or `rediss://...` | Redis connection URL with password authentication and TLS. |
| `DISTRIBUTED_MODE` | No | `true` or `false` | Enables multi-pod Redis coordination and rate limiting. |
| `TRUST_PROXY` | No | `true` or `false` (default: `true` in prod) | Trusts X-Forwarded-* headers from upstream reverse proxy/ALB. |
| `COOKIE_SECURE` | No | `true` or `false` (default: `true` in prod) | Enforces Secure, HttpOnly, and SameSite cookie attributes. |
| `GOOGLE_CLIENT_ID` | No | String OAuth client identifier | Client ID for Google OAuth 2.0 social authentication. |
| `BACKUP_SCHEDULE_ENABLED`| No | `true` or `false` | Enables internal cron for MongoDB export archives. |
| `BACKUP_RETENTION_DAYS` | No | Integer (default: `30`) | Number of days before backup archives are pruned. |
| `BACKUP_ENCRYPTION_KEY` | No | 32-character hex string | AES-256 encryption key for off-site backup archives. |

---

## 3. Staging Deployment & Validation Procedures

Staging mirrors production topology in an isolated sandbox environment using isolated staging databases, dummy storage buckets, and non-production credentials.

### 3.1 Launching Staging Stack
```bash
# 1. Deploy Staging Stack via Docker Compose
docker compose -f docker-compose.staging.yml up -d --build

# 2. Verify Container Health
docker compose -f docker-compose.staging.yml ps
```

### 3.2 Automated Staging Verification Checklist
- [x] **Preflight Verification**: `npm run preflight:prod` verifies environment configuration, storage access, and database connectivity.
- [x] **Database Index Migration**: `npm run migrate:indexes` executes dry-run verification followed by live index synchronization across all 25 registered schemas.
- [x] **Liveness Probe**: `GET /api/health/live` returns HTTP 200 `{ status: "ok", uptime: <seconds> }`.
- [x] **Readiness Probe**: `GET /api/health/ready` returns HTTP 200 confirming healthy database connectivity and storage probe access.
- [x] **Metrics Telemetry**: `GET /api/health/metrics` returns structured HTTP, memory, and database error counters without secret exposure.
- [x] **Regression Test Suite**: `node --test backend/tests/stagingProductionLaunch.test.js` passes all 17 integration checks.

---

## 4. Production Deployment & Zero-Downtime Rollout

### 4.1 Deployment Sequence
1. **Pre-Deployment Safety Checks**:
   - Run automated secret regression scan: `npm run scan:secrets`.
   - Run complete test suite and production bundle compilation:
     ```bash
     npm test
     npm run --prefix frontend build
     ```
   - Execute database index dry-run against staging replica: `npm run migrate:indexes -- --dry-run`.
2. **Database Preparation**:
   - Trigger manual pre-deployment MongoDB snapshot via Atlas / Cloud Provider backup console.
   - Run explicit index migration: `npm run migrate:indexes`.
3. **Application Rolling Update**:
   - Deploy container images with zero-downtime rolling replacement (e.g. Kubernetes RollingUpdate or ECS blue/green).
   - Upstream reverse proxy shifts traffic only after new pods pass `/api/health/ready` health checks for 3 consecutive intervals.
4. **Post-Deployment Smoke Verification**:
   - Verify `/api/health/live` and `/api/health/ready`.
   - Execute synthetic auth, document creation, and task movement tests.

---

## 5. Rollback Procedures & Incident Recovery

### 5.1 Immediate Application Rollback (< 5 minutes)
If critical error rates elevate post-deployment:
1. Revert container image tag to the last known stable commit.
2. Trigger immediate rolling update to restore prior container versions.
3. Since all database migrations in Klavo maintain additive backward compatibility, previous code versions run cleanly without schema rollbacks.

### 5.2 Point-in-Time Recovery (PITR) & Restore Drill
If data corruption or catastrophic failure occurs:
1. Identify target restoration timestamp prior to incident occurrence.
2. In the cloud database console (Atlas / AWS DocumentDB), initiate Point-In-Time Restore to a **new isolated cluster** (never restore in-place).
3. Update connection string `MONGO_URI` to point to the restored cluster once data integrity is confirmed.
4. Local disaster recovery drill verification tool:
   ```bash
   node backend/src/utils/backupManager.js --restore --backup-path=<path> --target-db=klavo_restore_verify
   ```

---

## 6. Credential Rotation & Launch Gates

### 6.1 Owner-Action Rotation Verification
In accordance with `docs/CREDENTIAL_ROTATION.md`:
- [x] **Tracked Secrets**: Automated scanner confirms 0 active secrets in repository.
- [ ] **MongoDB Atlas Password**: System owner manual rotation in Atlas Web Console.
- [ ] **Production JWT Secret**: System owner manual generation of 64-char hex key.
- [ ] **Google OAuth Client Secret**: System owner manual reset in Google Cloud Console.

> [!IMPORTANT]
> In accordance with safety policies, rotation of external cloud credentials must be executed directly by the repository owner in their respective provider consoles. Automated tools do not request or fabricate external credential rotation.

---

## 7. Operational Contacts & On-Call Roster

| Role | Contact Entity | Responsibilities |
|---|---|---|
| **Incident Commander** | Platform Owner (`thisisanimesh01`) | Authorizes rollback, failover, and external communication. |
| **Database Reliability** | Infrastructure Team | Database pooling, Atlas alerts, backup restoration. |
| **Security Officer** | Security Team | Credential rotation, secret leakage remediation, CVE reviews. |

---

## 8. Go / No-Go Launch Gate Checklist

Before opening public network traffic or completing DNS cutover:

- [x] **CI & Automated Tests**: Full backend suite (472 passed), frontend suite (156 passed), and Playwright E2E suite (16 passed) green.
- [x] **Secret Regression Audit**: 0 secrets found across Git-tracked files (`node scripts/scan_secrets.js`).
- [x] **Container Builds**: Production Dockerfile multi-stage build cleanly compiles frontend and backend without devDependencies.
- [x] **Staging Deployment Configuration**: Dedicated `docker-compose.staging.yml` created with isolated database, Redis, and volume persistence.
- [x] **Index Migrations**: Explicit `runIndexMigration` utility verified in dry-run and live synchronization modes.
- [x] **Health Probes**: Liveness (`/api/health/live`), readiness (`/api/health/ready`), and metrics (`/api/health/metrics`) operational.
- [x] **Security Defense-in-Depth**: Strict security headers (`nosniff`, `DENY`, `strict-origin-when-cross-origin`) and cookie attributes active.
- [ ] **Owner Action — Credential Rotation**: System owner executes manual rotation for Atlas database password, production JWT key, and Google OAuth client secret.
- [ ] **Owner Action — DNS & TLS Cutover**: Production domain DNS mapped to reverse proxy with TLS certificates provisioned.

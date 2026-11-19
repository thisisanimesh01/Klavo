# Production Monitoring, Logging, Backups & Disaster Recovery (REL-07)

This document specifies the operational architecture, structured logging standards, health monitoring, metrics telemetry, and backup/restore procedures for Klavo in production.

---

## 1. Structured Production Logging

### Log Architecture
Klavo uses a centralized, zero-dependency structured JSON logger (`backend/src/utils/logger.js`) that produces single-line JSON log events to `stdout` (for `DEBUG`, `INFO`, `WARN`) and `stderr` (for `ERROR`).

### Standard Log Schema
```json
{
  "timestamp": "2026-11-19T15:21:13.515Z",
  "severity": "INFO",
  "service": "klavo-backend",
  "environment": "production",
  "requestId": "e5fe627b-51d4-46ba-b0a5-1f2b31b5f384",
  "message": "HTTP request completed successfully",
  "context": {
    "method": "GET",
    "path": "/api/projects",
    "statusCode": 200,
    "durationMs": 14.2,
    "userAgent": "Mozilla/5.0 ...",
    "ip": "192.168.1.10"
  }
}
```

### Automatic Sensitive Field & Secret Redaction
All log contexts and messages pass through recursive redaction (`redact()` and `redactString()`) before emission:
- **Redacted Keys**: `password`, `token`, `jwt`, `authorization`, `cookie`, `secret`, `credential`, `key`, `cert`, `private`, `access_key`, `secret_access_key`, `mongo_uri`, `database_url`, `content` (document text), `yjsUpdate` (collaborative binary state).
- **Embedded URI Redaction**: URI regex sanitizes passwords embedded in connection strings: `mongodb+srv://[REDACTED]:[REDACTED]@cluster...`
- **Bearer Tokens**: HTTP Authorization headers and string matches are replaced with `Bearer [REDACTED]`.
- **Stack Traces**: In `production`, stack traces are stripped from error logs and client responses to prevent internal path and library exposure.

### Request Correlation Across Async Calls
Using Node.js `AsyncLocalStorage` (`backend/src/middleware/requestLogger.js`):
- Every HTTP request accepts or generates a unique correlation ID via `X-Request-ID`.
- The correlation ID is echoed on the response headers and automatically bound to any log statement emitted during the request life cycle, even across asynchronous database or storage calls.

---

## 2. Operational Health & Probes

Klavo distinguishes between process liveness and downstream dependency readiness (`backend/src/routes/healthRoutes.js`):

| Endpoint | Purpose | Target | Checks Performed | HTTP Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/health/live` | **Liveness Probe** | Orchestrator (K8s, ECS, Render) | Checks that Node.js process is responsive and event loop is healthy. | `200 OK` |
| `GET /api/health/ready` | **Readiness Probe** | Load Balancers / Ingress | Verifies that MongoDB ping succeeds (`admin().ping()`) and Storage provider is initialized. | `200 OK` (Ready), `503 Service Unavailable` (Not Ready) |
| `GET /api/health/metrics` | **Metrics Telemetry** | Scraping / Prometheus / Datadog | Aggregated request latency, status distributions, active Socket.IO connections, DB errors, and memory. | `200 OK` |

*Security Guarantee*: Health endpoints never dump database connection URIs, credentials, or internal configuration state.

---

## 3. Metrics & Monitoring Instrumentation

Klavo incorporates lightweight in-memory metrics (`backend/src/utils/metrics.js`):
- **HTTP Latency & Throughput**: Total requests, latency distribution buckets (`<=50ms`, `<=100ms`, `<=250ms`, `<=500ms`, `<=1000ms`, `overflow`), and status code counts (`2xx`, `4xx`, `5xx`).
- **Database Failures**: Tracks connection/query error counts and timestamp of most recent database failure.
- **Socket.IO Telemetry**: Active connected sockets, lifetime connections, and disconnection events.
- **Workflow Automation**: Automation execution counter, failure counter, and failure timestamps.
- **Storage Operations**: Upload/download/delete operations and failure counters.
- **Process Resources**: Process uptime, resident set size (RSS), heap total, heap used, and system load averages.

### External Monitoring Integration
To forward metrics to external systems (e.g. Datadog, Prometheus, Grafana Cloud, CloudWatch):
1. **Scraping**: Configure your Prometheus or Datadog agent to scrape `GET /api/health/metrics` on a 15s or 30s interval.
2. **Log Shippers**: Point AWS CloudWatch Logs, Vector, or FluentBit to stdout to ingest JSON logs directly. Log aggregators parse `severity`, `requestId`, and `context.durationMs` out of the box.

---

## 4. MongoDB Backup & Disaster Recovery Runbook

### Recovery Objectives (Configurable Operational Targets)
> [!NOTE]
> Recovery Point Objectives (RPO) and Recovery Time Objectives (RTO) are operational design targets dependent on infrastructure tier and database cluster provisioning, not arbitrary platform guarantees:
> - **RPO Target**: $\le 1$ hour (with automated hourly snapshots or continuous point-in-time recovery via MongoDB Atlas / replica set oplog).
> - **RTO Target**: $\le 30$ minutes (using automated restore scripts into verified database instances).

### Backup Strategy & Tooling
Klavo provides an automated backup and restore utility (`backend/src/utils/backupManager.js`):
- **Command**: `npm run backup:create` (or `node src/utils/backupManager.js`)
- **Mechanism**:
  1. Executes `mongodump --uri=$MONGO_URI --gzip --out=backups/backup-<timestamp>` when `mongodump` binary is present.
  2. Falls back to consistent JSON collection exports with an authoritative `backup-manifest.json` manifest.
- **Retention Schedule**:
  - Daily backups: Retain for 30 days.
  - Weekly backups: Retain for 12 weeks.
  - Monthly backups: Retain for 12 months.
  - Storage: Backups should be transferred to encrypted, versioned secondary cloud storage (e.g. AWS S3 Glacier or Cloudflare R2 with object lock).

### Isolated Restore Verification Procedure
> [!CAUTION]
> **Production Protection Invariant**: `runMongoRestore` strictly blocks restore operations against production databases (`NODE_ENV=production`) unless `allowProductionRestore: true` is explicitly provided. Always verify restores in an isolated sandbox database first!

To verify a backup without risking production data:
```bash
# 1. Run restore verification against isolated database target
node src/utils/backupManager.js --restore --path ./backups/backup-2026-11-19T15-00-00-000Z

# Script verifies:
# - Integrity of backup-manifest.json
# - Deletion of stale collections in verification database (default: klavo_restore_verification)
# - Successful document re-insertion and count validation
```

---

## 5. Object Storage (S3 / R2 / MinIO) Backup & Recovery

1. **Provider Versioning**:
   - In production, enable **Bucket Versioning** and **Object Lock (WORM)** on your S3 or Cloudflare R2 bucket.
   - Deleted files in Klavo mark the storage key as deleted, but bucket versioning preserves previous revisions for recovery in the event of accidental deletion or ransomware.
2. **Lifecycle & Retention Rules**:
   - Expire non-current versions after 90 days.
   - Transition multipart aborts after 24 hours to prevent incomplete upload accumulation.
3. **Local Storage Limitations**:
   - Local disk storage (`STORAGE_PROVIDER=local`) is suitable only for development, continuous integration, or single-node container setups with persistent volume claims (PVC). Local files are not replicated across horizontal instances.

---

## 6. Multi-Instance & High Availability Architecture Assessment

The table below outlines current operational capabilities and architectural requirements for multi-instance horizontal scaling:

| Subsystem | Single Node (Current) | Multi-Node Horizontal Architecture Requirement | Status / Strategy |
| :--- | :--- | :--- | :--- |
| **HTTP API** | Fully Stateless | Stateless behind reverse proxy / ingress load balancer | Production Ready |
| **Authentication** | JWT + Cookie Fallback | Stateless JWT verification across instances | Production Ready |
| **Socket.IO** | In-Memory Server | `@socket.io/redis-adapter` required to broadcast across multiple instances | Multi-instance Gap Identified (Requires Redis cluster) |
| **Yjs CRDT Docs** | In-Memory Room Map + MongoDB binary snapshot | Redis pub/sub or distributed Yjs WebSocket gateway required for multi-pod edits | Multi-instance Gap Identified (Persisted in DB on disconnect) |
| **Rate Limiter** | In-Memory Sliding Window (`Map`) | Redis-backed token bucket required for cross-pod rate limiting | Documented limitation (Local to each pod) |
| **Automation Engine** | Event-driven per request | Message queue (e.g. BullMQ / RabbitMQ) for distributed cron or async background tasks | In-process execution per HTTP request |

---

## 7. Recommended Production Alerting Thresholds

| Metric | Condition | Severity | Recommended Action |
| :--- | :--- | :--- | :--- |
| `http.statusCodes["5xx"]` | Rate $> 1\%$ for 5 minutes | Critical (P1) | Check backend logs for unhandled exceptions or DB connectivity drops. |
| `database.errorCount` | $> 5$ failures in 1 minute | Critical (P1) | Verify MongoDB Atlas / Replica Set cluster health and network connectivity. |
| `api/health/ready` | HTTP 503 for $\ge 2$ consecutive probes | Critical (P1) | Alert on-call; check readiness check payload for failed dependency. |
| `process.memory.heapUsedMb` | $> 80\%$ of container limit | Warning (P2) | Investigate potential memory leaks or scale up container memory allocation. |
| `storage.errorCount` | $> 5$ upload failures in 5 minutes | Warning (P2) | Verify S3 IAM credentials, bucket policy, or endpoint connectivity. |

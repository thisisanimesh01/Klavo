# Persistent Object Storage & Deployment Architecture (REL-05)

## 1. Overview & Architecture
Klavo uses an abstracted `StorageService` to manage project file attachments, user avatars, and team/workspace logos. Prior to REL-05, binary assets were exclusively stored on the local container filesystem under the `uploads/` directory.

In **REL-05**, Klavo introduces production-grade **persistent object storage** via an S3-compatible provider (`S3CompatibleStorageProvider`). This enables drop-in deployment with **AWS S3**, **Cloudflare R2**, **MinIO**, or **Google Cloud Storage (S3-interoperability mode)** without hardcoded vendor credentials or changes to controller logic.

```
+-------------------------------------------------------------+
|                      Klavo Application                      |
|                                                             |
|   +-------------------+  +-------------------+  +-------+   |
|   |  File Controller  |  |  User Controller  |  | Teams |   |
|   +---------+---------+  +---------+---------+  +---+---+   |
|             |                      |                |       |
|             +----------------------+----------------+       |
|                                    |                        |
|                                    v                        |
|                         +---------------------+             |
|                         |   StorageService    |             |
|                         +----------+----------+             |
|                                    |                        |
|                 +------------------+------------------+     |
|                 |                                     |     |
|                 v                                     v     |
|     +-----------------------+             +---------------+ |
|     | LocalDiskStorage      |             | S3Compatible  | |
|     | (Local Dev / Staging) |             | Storage       | |
|     +-----------+-----------+             +-------+-------+ |
+-----------------|---------------------------------|---------+
                  |                                 |
                  v                                 v
        [ Local Filesystem ]           [ AWS S3 / R2 / MinIO ]
```

---

## 2. Environment Configuration

Provider selection is governed by the `STORAGE_PROVIDER` environment variable. Required variables depend on the selected provider.

| Variable Name | Required | Default | Description |
|---|---|---|---|
| `STORAGE_PROVIDER` | No | `local` | Storage provider strategy: `local` or `s3`. |
| `UPLOADS_DIR` | No | `uploads` | Local directory for file storage (local mode) or temporary multipart staging. |
| `S3_BUCKET` | Yes (for S3) | — | Target private S3 bucket name. |
| `S3_REGION` | No | `us-east-1` | AWS region or region identifier (e.g. `auto` for Cloudflare R2). |
| `S3_ENDPOINT` | No | AWS default | Custom S3 API endpoint. Required for MinIO, Cloudflare R2, or local emulator. |
| `S3_ACCESS_KEY_ID` | Yes (for S3) | — | Object storage access key ID / API token ID. |
| `S3_SECRET_ACCESS_KEY` | Yes (for S3) | — | Object storage secret access key / API token secret. |
| `S3_FORCE_PATH_STYLE` | No | `true` | When `true`, uses path-style URL scheme (`http://endpoint/bucket/key`), ideal for MinIO and R2. |

> [!CAUTION]
> Never commit actual access keys or secrets to source control or environment example templates. All secrets must be injected securely at runtime via secrets managers or container environment injection.

---

## 3. Storage Security & Private Bucket Policies

### 3.1 Strict Authorization Prior to Access
- **Private Buckets Only**: All production buckets must have **public access completely blocked** (`BlockPublicAcls = true`, `BlockPublicPolicy = true`, `IgnorePublicAcls = true`, `RestrictPublicBuckets = true`).
- **No Direct Bucket URL Exposure**: Bucket URLs are never exposed directly to client browsers without prior authorization.
- **Application Authorization Gate**:
  - `GET /api/files/download/:fileId`: Requires JWT authentication and verifies project team membership via `checkProjectAccess` before streaming file bytes.
  - `DELETE /api/files/:fileId`: Enforces uploader, project creator, or team owner authorization.
  - `GET /api/users/avatar/:key` & `GET /api/teams/logo/:key`: Sanitizes keys and sets strict security headers before serving.

### 3.2 Security Headers & MIME Protections
- **Path Traversal Defense**: All storage keys are sanitized through `sanitizeS3Key()` and `sanitizeKey()` to remove null bytes, directory traversal patterns (`../`, `..\`), and dangerous characters.
- **MIME Whitelisting & Active Script Defense**:
  - Uploads are strictly validated against a MIME whitelist.
  - SVG uploads are inspected using `isSafeSvg()` to detect and reject active XML/HTML scripts, javascript URIs, inline handlers (`onload`, `onerror`), and `<foreignObject>` tags.
- **Content Security Policy**: Downloads and streamed assets include:
  ```http
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox
  Content-Disposition: attachment; filename="<sanitized_filename>"
  ```

---

## 4. Local-to-Object Migration Utility (`StorageMigrator`)

The `StorageMigrator` service safely transitions existing uploads from local disk to S3-compatible persistent storage.

### 4.1 Safety Principles
1. **Dry-Run by Default**: Previews the migration manifest, total file count, and byte volume without altering files or triggering uploads.
2. **Non-Destructive**: Never deletes local source files unless explicit destructive flags (`deleteSourceAfterCopy: true`) are set.
3. **Resumable & Collision Avoidance**: Checks remote object existence before uploading. If a file is already present, it is safely skipped (`status: "skipped"`), avoiding redundant network transfers or overwrites.
4. **Comprehensive Integrity Verification**:
   - Queries target object metadata via `headObject()` to verify destination `contentLength` matches local file size.
   - Reads destination object buffer to compute and verify SHA-256 checksum matches local source SHA-256 before marking the record as migrated.
   - If checksum or size fails verification, throws an error, flags the record as `failed`, and halts destructive deletion.

---

## 5. MongoDB Production Configuration & Pooling Invariants

Klavo connects to MongoDB with optimized production connection pooling and timeout invariants configured via `getMongoConnectionOptions()` in `backend/src/config/db.js`:

| Setting | Default Value | Production Behavior | Purpose |
|---|---|---|---|
| `autoIndex` | `false` in production (`true` in dev/test) | Disabled in production | Prevents automatic background index builds that can block database operations or cause high lock overhead during cluster deployments. |
| `maxPoolSize` | `20` (configurable via `MONGO_MAX_POOL_SIZE`) | Capped connection pool | Limits concurrent sockets per container pod to avoid exhausting MongoDB Atlas connection limits. |
| `minPoolSize` | `2` (configurable via `MONGO_MIN_POOL_SIZE`) | Warm standby sockets | Maintains pre-warmed connection pool for instant request handling. |
| `serverSelectionTimeoutMS` | `5000` (5s) | Fast failure threshold | Prevents application threads from hanging indefinitely during primary stepdowns or network partitions. |
| `socketTimeoutMS` | `45000` (45s) | Socket inactivity cap | Automatically terminates frozen socket connections. |
| `heartbeatFrequencyMS` | `10000` (10s) | Periodic replica checks | Rapidly detects cluster topology changes or node failover. |

---

## 6. Backup, Restore & Lifecycle Policies

1. **Bucket Versioning**: Enable versioning on the target S3 bucket to protect against accidental deletions or overwrites.
2. **Lifecycle Policies**:
   - Clean up incomplete multipart uploads after 7 days.
   - Retain non-current object versions for 30–90 days for disaster recovery.
3. **Disaster Recovery**:
   - Replicate primary bucket to a secondary region or cloud provider (e.g. AWS S3 to Cloudflare R2 bucket replication).
   - Database records in MongoDB store metadata (`storageKey`, `filename`, `size`, `projectId`). A database restore paired with bucket snapshot restore ensures complete state consistency.

---

## 6. Multi-Instance & Horizontal Scaling Assessment

While persistent object storage decouples file storage from local container disks, running multiple concurrent backend instances requires addressing shared state across other subsystems:

| Subsystem | Single-Instance Status | Multi-Instance Implication | Horizontal Scalability Status |
|---|---|---|---|
| **File Storage** | Fully persistent via S3 provider | Shared object storage enables multi-instance stateless file upload and streaming. | **Ready (Validated)** |
| **Database (MongoDB)** | Shared multi-instance ready | Mongoose connections share central MongoDB Atlas or replica set. | **Ready (Validated)** |
| **Socket.IO Real-Time** | Process memory room management | Requires `@socket.io/redis-adapter` or Redis Pub/Sub for cross-pod real-time event broadcasting. | **Pending (Outside REL-05)** |
| **Yjs CRDT Collaboration** | Process memory (`activeDocRooms`) | Active rooms currently reside in memory per instance. Requires shared Yjs persistence adapter (e.g. `y-redis` or central coordinator). | **Pending (Outside REL-05)** |
| **Rate Limiter** | Process memory sliding window | In-memory maps count requests per pod. Requires Redis-backed rate limiting for cluster-wide enforcement. | **Pending (Outside REL-05)** |
| **Recurring Automation Engine** | In-process `setInterval` timers | Multiple instances running `setInterval` would execute duplicate automated recurring tasks. Requires distributed lock or scheduler (BullMQ / agenda / Redis redlock). | **Pending (Outside REL-05)** |

*These subsystems remain single-instance bounded until distributed adapters are introduced.*

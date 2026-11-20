# Klavo Security Audit & Penetration-Test Preparation (REL-03)

This document establishes the official security architecture audit, threat model, vulnerability register, historical credential exposure assessment, penetration testing guidelines, and residual risk tracking for the Klavo application platform.

---

## 1. Executive Summary

As part of Klavo Phase 8 (Release Preparation & Hardening), Milestone REL-03 conducted an exhaustive structured security audit across all layers of the stack:
- **Authentication & Account Lifecycle**: JWT issuance/verification, password hashing, credential migration, password change validation, and session termination.
- **Access Control & Authorization**: Role-Based Access Control (Owner, Admin, Member, Guest), IDOR/BOLA mitigations across multi-tenant boundaries (Teams, Projects, Tasks, Documents, Sprints, Milestones).
- **Real-Time WebSockets**: Socket.IO authentication handshakes, user channel isolation, authorized room joins (`team_*`, `project_*`, `comment_*`, `document_*`), and collaborative Yjs epoch protections.
- **File Upload & Storage Security**: Allowed MIME type enforcement, file size limits, SVG script scanning (`isSafeSvg`), path traversal checks, and strict CSP headers on binary downloads.
- **Injection & Data Validation**: NoSQL injection avoidance via Mongoose models, formula injection neutralization in CSV/PDF exports, and input sanitization.
- **Network & HTTP Defense**: Global HTTP security headers (nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS in production, and removal of `X-Powered-By`).

---

## 2. Threat Model (STRIDE)

| Threat Category | Potential Attack Vector | Klavo Defense & Architectural Controls | Status |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Forged JWT tokens, unauthorized socket connection impersonation | Secret-signed JWTs (HMAC-SHA256) with 30-day expiration; socket authentication middleware verifying token before assigning identity. | **Mitigated** |
| **Tampering** | Parameter tampering in task/document updates, NoSQL payload injection | Typed Mongoose schemas; explicit authorization checks (`checkProjectAccess`, `checkTaskAccess`, `checkDocumentAccess`); sanitization of update fields. | **Mitigated** |
| **Repudiation** | Denying creation or modification of critical workspace assets | Activity logging (`Activity` model and `activityController`); audit logging for automation rules (`AutomationLog`); document snapshot history. | **Mitigated** |
| **Information Disclosure** | IDOR to view other projects/teams, stack trace leak on errors, directory listing | Strict multi-tenant tenancy checks on all API endpoints and sockets; centralized `errorHandler` masking internal traces in production; CSP and `nosniff` on asset serving. | **Mitigated** |
| **Denial of Service** | Authentication credential stuffing, large file upload flooding, infinite automation loops | In-memory sliding-window `rateLimit` middleware on sensitive routes (`/api/auth/*`, `/api/users/change-password`, `/api/files/upload`); max 25MB file limits; automation execution depth capped at 3. | **Mitigated** |
| **Elevation of Privilege** | Member elevating self to Owner/Admin, Guest accessing restricted boards | Explicit role matrix (`canManageMembers`, `canTransferOwnership`); ownership transfer restricted to current owner; guest users prohibited from admin operations. | **Mitigated** |

---

## 3. Security Findings Register

### Finding SEC-REL03-01: Missing Explicit Session Termination Endpoint
- **Severity**: **Medium**
- **Affected Component**: `backend/src/routes/authRoutes.js`, `frontend/src/components/Topbar.jsx`
- **Description**: While frontend cleared client-side tokens on logout, the backend had no dedicated `/api/auth/logout` endpoint to invalidate server cookies or signal explicit session termination.
- **Remediation**: Implemented `POST /api/auth/logout` on `authRoutes` to clear authentication cookies (`res.clearCookie("token")`) and return structured JSON acknowledgment.
- **Verification**: Regression test in `backend/tests/securityAudit.test.js` confirms 200 OK and cookie clearance.

### Finding SEC-REL03-02: Missing Global Defense-in-Depth HTTP Security Headers
- **Severity**: **Medium**
- **Affected Component**: `backend/src/app.js`, `backend/src/middleware/securityHeaders.js`
- **Description**: Asset downloads and logo endpoints had localized security headers, but the main Express application pipeline lacked global security headers, exposing `X-Powered-By: Express` and leaving responses vulnerable to clickjacking (`X-Frame-Options`) and MIME confusion (`X-Content-Type-Options: nosniff`).
- **Remediation**: Implemented native `securityHeaders` middleware applied globally in `app.js`. Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 0`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, HSTS on production, and removes `X-Powered-By`.
- **Verification**: Regression tests in `backend/tests/securityAudit.test.js` verify presence of all defensive headers and removal of `X-Powered-By`.

### Finding SEC-REL03-03: Permissive Unauthenticated Socket Room Joins
- **Severity**: **High**
- **Affected Component**: `backend/src/index.js`, `backend/src/sockets/notifications.js`, `backend/src/sockets/comments.js`, `backend/src/sockets/reactions.js`
- **Description**: Sockets that failed handshake authentication (`socket.user = null`) were still allowed to join team, project, comment, and reaction rooms if handlers lacked an unauthenticated guard.
- **Remediation**: Enforced strict `if (!socket.user)` authentication guards on all room subscription handlers (`joinTeam`, `joinProject`, `joinUser`, `joinCommentThread`, `joinReactions`), returning immediate `{ message: "Unauthorized: Authentication required..." }` error events.
- **Verification**: Regression tests in `backend/tests/securityAudit.test.js` and `backend/tests/socketIntegration.test.js`.

---

## 4. Historical Credential Exposure Assessment & Remediation Guide

During git commit log inspection, historical commits dating from the initial repository upload in November 2025 (`0a59b32` and `afa8390`) included sample or temporary development `.env` files before `.gitignore` was permanently established.

> [!IMPORTANT]
> In accordance with zero-trust security guidelines, historical credentials committed to version control must be treated as **permanently compromised** and invalidated at the identity provider level rather than relying solely on Git history scrubbing.

### Required Production Remediation Procedure:
1. **Rotate MongoDB Credentials**:
   - In MongoDB Atlas / production cluster, generate new database user credentials.
   - Update deployment environment variables with the new connection string (`MONGO_URI`).
   - Revoke access for the prior database user.
2. **Rotate JWT Secret**:
   - Generate a cryptographically secure 256-bit secret (`openssl rand -hex 32`).
   - Update `JWT_SECRET` in production configuration. Existing user sessions will be safely invalidated, requiring re-authentication.
3. **Rotate Google OAuth 2.0 Client Secret**:
   - In Google Cloud Console (`APIs & Services > Credentials`), rotate the client secret for the OAuth client ID.
   - Update `GOOGLE_CLIENT_SECRET` in server environment settings.
4. **Git Repository Hygiene (Optional Maintenance)**:
   - If required by organization policy, run `git filter-repo` or BFG Repo-Cleaner in a coordinated maintenance window with maintainer approval. Do not rewrite history without team notification.

---

## 5. Safe Penetration Testing Procedures

When conducting scheduled authorized penetration testing of Klavo, security engineers must follow these guidelines:

### Test Environment Setup
- Deploy tests **strictly against isolated staging environments** or local test servers spun up via `e2e/fixtures/testEnvironment.js`.
- Never run penetration tests, fuzzers, or scanning tools against production systems or shared team databases.

### Recommended Test Scenarios:
1. **BOLA / IDOR Testing**:
   - Create two test users: `UserA` (Team Alpha) and `UserB` (Team Beta).
   - Use `UserB`'s bearer token to attempt GET/POST/PUT/DELETE on `UserA`'s tasks, projects, document folders, and comments.
   - Verify all cross-tenant requests yield `403 Forbidden` or `404 Not Found`.
2. **File Upload Payload Testing**:
   - Attempt uploading malicious SVG files containing `<script>` tags, inline `onload` handlers, or external entity references.
   - Verify `isSafeSvg()` detects and rejects the payload with `400 Bad Request`.
   - Attempt uploading executable extensions (`.sh`, `.exe`, `.php`, `.jsp`). Verify rejection via allowed MIME map.
3. **Rate Limiting Tests**:
   - Send > 20 requests in 60 seconds to `/api/auth/login`. Verify `429 Too Many Requests` is returned with rate limit headers.
4. **Collaborative WebSocket Race Tests**:
   - Connect concurrent sockets to a shared document and simulate stale epoch updates.
   - Verify authoritative server synchronization prevents out-of-order state corruption.

---

## 6. Dependency Vulnerability Assessment

Running `npm audit` across the project revealed:
- **Root Project**: 0 vulnerabilities.
- **Backend**: 20 vulnerabilities (1 low, 8 moderate, 11 high). Primarily located in transitive dependencies (e.g., `express` 4.18.2 / `body-parser`, `multer`, `socket.io-parser`, `cookie`).
  - No exploitable direct vulnerability exists in Klavo application code.
  - Mitigated by input validation schemas, file type whitelists, size limits, and `securityHeaders`.
  - Next maintenance: Upgrade Express from 4.18 to 4.21+ / Express 5 and update socket.io-parser in the next maintenance cycle.
- **Frontend**: 20 vulnerabilities (1 low, 7 moderate, 12 high). In development/bundling toolchains (e.g., `rollup`, `vite`, `axios`, `ws`).
  - Mitigated by static asset compilation with no runtime Node server execution on the client.
- **Automated Regression Defense**: `scripts/scan_secrets.js` runs in CI ensuring zero exposed credentials or API tokens in tracked files.

---

## 7. Phase 9 Milestone 5: Security Remediation & Penetration-Test Hardening (SEC-10)

As part of Milestone SEC-10, an in-depth security penetration audit and remediation cycle was conducted across critical security surfaces:

### 1. Authentication & JWT Tamper Defense
- **Algorithm Confusion Attacks**: Validated that `jwt.verify` strictly rejects tokens with `alg: "none"` or unapproved algorithms, requiring valid HMAC-SHA256 signatures with the configured secret.
- **Token Expiration**: Strict enforcement of token expiration rejects expired signatures and prevents replayed sessions.
- **Token Signature Integrity**: Altered payloads or truncated signatures immediately fail verification.

### 2. Workspace RBAC & Immediate Socket Revocation
- **Hierarchy Resolution**: Roles are strictly mapped (`owner: 4`, `admin: 3`, `member: 2`, `guest: 1`, `none: 0`). Outsiders resolve to `none` preventing unauthorized operations.
- **Real-Time Member Eviction**: In `backend/src/controllers/teamController.js`, when a team member is removed from a workspace, the backend emits `workspaceAccessRevoked` and `teamMemberRemoved` to the member's private channel (`user_<memberId>`) and the team room (`team_<teamId>`), causing the client to immediately drop real-time subscriptions and evict from workspace views without waiting for session expiration.

### 3. Object Storage (S3) & Path Traversal Mitigations
- **Path Sanitization**: Key paths are cleansed of `..`, `\` and null bytes via `path.posix.normalize` and sanitization checks, confining all operations within the workspace bucket prefix.
- **SigV4 Presigned URLs**: Presigned GET/PUT URLs are signed using AWS SigV4 with strictly capped expiration windows (default 15 minutes) and required headers (`x-amz-content-sha256: UNSIGNED-PAYLOAD`).

### 4. File Upload XSS & SVG Script Sanitization
- **SVG Defense**: Strict script and event handler detection (`<script>`, `onload`, `javascript:`, `xlink:href`) rejects dangerous vectors before storage, accompanied by `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.

### 5. Redis Transport Security & Distributed Safety
- **TLS Protocol Handling**: In `backend/src/utils/redisCoordinator.js`, Redis connections with `rediss://` or `REDIS_TLS=true` natively establish encrypted TLS sockets via Node.js `tls.connect` with SNI validation.
- **Distributed Safety Invariants**: Distributed mode fails safely if Redis is unreachable or misconfigured, and rate limiters fall back to robust in-memory sliding windows.

### 6. Backup Authenticated Encryption & Tamper Proofing
- **Authenticated Encryption**: Automated backups employ AES-256-GCM. Any ciphertext or auth tag modification immediately throws cryptographic errors and aborts restore operations.
- **Checksum Manifests**: Every backup archive includes SHA-256 manifests verifying uncorrupted state before decryption.

---

## 8. Residual Risks & Next Steps

1. **JWT Revocation / Blacklisting**: Current tokens expire after 30 days. Introducing a Redis-backed token revocation list or shortening token lifetime to 15 minutes with refresh tokens is recommended for future releases.
2. **CORS Origin Restriction**: In local development, CORS is configured with `origin: true`. In production deployment, `CORS_ORIGIN` environment variable should strictly whitelist the production domain.
3. **Dependency Upgrades**: Upgrading to Express 5 and updating `multer` and `socket.io-parser` when upstream packages stabilize breaking changes.

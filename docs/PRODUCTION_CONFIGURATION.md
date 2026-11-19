# Production Environment & Secrets Configuration (REL-06)

## 1. Overview & Architecture

Milestone **REL-06** hardens Klavo's production configuration, secrets management, environment validation, CORS policies, secure cookie attributes, and operational preflight tooling.

Key security requirements addressed:
1. **Zero Secret Leakage**: Centralized validation fails cleanly with missing/malformed parameter names, **never printing secret values, passwords, or hashes** in logs, exceptions, or client payloads.
2. **Environment Separation**: Strict differentiation between `development`, `test`, and `production`.
3. **Public vs. Private Variable Boundaries**: Distinct separation between public build-time frontend variables (`VITE_*`) and private backend environment secrets.
4. **Preflight Operational Verification**: The `npm run preflight:prod` readiness probe non-destructively verifies environment validity, database connectivity, and object storage accessibility before process boot.
5. **Historical Secret Remediation**: Authoritative zero-trust credential rotation guide for historical secrets committed during initial repository setup (`0a59b32` and `afa8390`).

---

## 2. Environment Variables & Schemas

### 2.1 Backend Environment Variables

| Variable Name | Required | Default | Sensitivity | Description |
|---|---|---|---|---|
| `NODE_ENV` | No | `development` | Public | Environment tier: `development`, `test`, or `production`. |
| `PORT` | No | `5050` | Public | HTTP port the Express server binds to. |
| `MONGO_URI` | **Yes** | — | **Critical Secret** | MongoDB connection string (`mongodb://` or `mongodb+srv://`). |
| `JWT_SECRET` | **Yes** | — | **Critical Secret** | Cryptographic key for signing JWT tokens. Must be >= 32 characters in production. |
| `FRONTEND_URL` | Yes (in prod) | `http://localhost:5173` | Config | Web client origin for strict CORS and redirect validation. Must use `https://` in prod. |
| `ALLOWED_ORIGINS` | No | `$FRONTEND_URL` | Config | Comma-delimited list of authorized browser origins for CORS. |
| `GOOGLE_CLIENT_ID` | No | `""` | Public Identifier | Google OAuth 2.0 Web Client ID for ID token signature verification. |
| `STORAGE_PROVIDER` | No | `local` | Config | Storage strategy: `local` (filesystem) or `s3` (object store). |
| `UPLOADS_DIR` | No | `uploads` | Config | Filesystem directory for local uploads or multipart staging. |
| `S3_BUCKET` | Yes (if S3) | — | Config | Target S3 bucket name. |
| `S3_REGION` | No | `us-east-1` | Config | S3 region or `auto` for Cloudflare R2. |
| `S3_ENDPOINT` | No | AWS default | Config | Custom S3 endpoint URL (MinIO, R2, GCS). |
| `S3_ACCESS_KEY_ID` | Yes (if S3) | — | **Secret** | S3 API access key ID. |
| `S3_SECRET_ACCESS_KEY` | Yes (if S3) | — | **Critical Secret** | S3 API secret access key. |
| `S3_FORCE_PATH_STYLE`| No | `true` | Config | Enable path-style S3 URLs (`/bucket/key`). |
| `TRUST_PROXY` | No | Auto in prod | Config | Trust reverse proxy headers (`X-Forwarded-Proto`, `X-Forwarded-For`). |
| `COOKIE_SECURE` | No | Auto in prod | Config | Enforce `Secure; HttpOnly; SameSite=Lax` on auth cookies. |

### 2.2 Frontend Build-Time Variables (`VITE_*`)

> [!IMPORTANT]
> All `VITE_*` variables are statically injected into public client JavaScript bundles by Vite at build time. **Never store backend secrets, database passwords, or JWT keys in frontend configuration.**

| Variable Name | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `/api` | Base REST API URL accessed by client Axios instance. |
| `VITE_BACKEND_URL` | No | `http://localhost:5050` | Base Socket.IO backend host URL. |
| `VITE_GOOGLE_CLIENT_ID` | No | — | Google OAuth Client ID for the Google Sign-In button component. |

---

## 3. Production Readiness & Preflight Tooling

Klavo provides an automated, non-destructive production preflight probe:

```bash
# In backend directory:
npm run preflight:prod # or node src/utils/preflightCheck.js
```

### Verification Steps Performed:
1. **Configuration Validation**: Verifies all required variables exist, checks URI formatting, validates production JWT entropy (minimum 32 characters), and checks HTTPS requirements for CORS origins.
2. **Database Ping**: Establishes a read-only MongoDB connection and executes a non-destructive `admin.ping()`. Never inserts, updates, or deletes records.
3. **Storage Accessibility**: Verifies local uploads directory writeability or executes a non-destructive probe against the configured S3 bucket.
4. **Exit Codes**: Returns exit code `0` on clean verification; returns `1` with safe error explanations if any check fails.

---

## 4. Historical Secrets Remediation & Rotation Checklist

In early repository commits (`0a59b32` and `afa8390`), development configuration files were tracked before `.gitignore` rules were established. Under zero-trust security guidelines, **any secret committed to Git history must be considered compromised**.

> [!CAUTION]
> The following rotation procedures must be executed directly by the repository owner in their respective cloud management consoles.

### 4.1 MongoDB Atlas Credential Rotation
1. **Access Management**:
   - Navigate to **MongoDB Atlas Console** > **Database Access**.
   - Create a new database user (e.g. `klavo-prod-v2`) with readWrite permissions on the `klavo` database only.
   - Generate a cryptographically secure random password (>= 24 characters).
2. **Network Access**:
   - Verify IP Access List in Atlas restricts connections exclusively to application server / container cluster IPs.
3. **Application Update**:
   - Update `MONGO_URI` in production secrets manager (AWS Secrets Manager, GCP Secret Manager, or environment config).
   - Trigger zero-downtime rolling deployment of Klavo backend containers.
4. **Revocation**:
   - Once all pods are healthy and connected via the new credentials, delete the old database user in Atlas Console.

### 4.2 JWT Signing Key Rotation & Session Invalidation
Rotating `JWT_SECRET` invalidates all active user sessions, forcing users to re-authenticate with their credentials or Google OAuth.

1. **Generate New Secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Deployment Order**:
   - Update `JWT_SECRET` in production configuration.
   - Restart/redeploy backend service instances.
   - When restarted, existing client JWTs will fail signature verification with `401 Unauthorized`.
   - Frontend Axios interceptors automatically catch `401` responses and redirect users to `/login`.

### 4.3 Google OAuth 2.0 Credentials
1. Navigate to **Google Cloud Console** > **APIs & Services** > **Credentials**.
2. Under **OAuth 2.0 Client IDs**, select the client ID used by Klavo.
3. Verify authorized JavaScript origins (`https://<app-domain>`) and authorized redirect URIs match production URLs exactly.
4. If client secrets were previously exposed, generate a new client secret, update production configuration, and delete the old secret.

---

## 5. Deployment Setup & Recommendations

1. **Reverse Proxy Configuration (Nginx / Cloudflare / AWS ALB)**:
   - Ensure the reverse proxy sets `X-Forwarded-Proto: https` and `X-Forwarded-For: $remote_addr`.
   - Set `TRUST_PROXY=true` in Klavo backend environment to enable accurate rate limiting and HTTPS detection.
2. **Container Security**:
   - Run backend Node processes under non-root users (`USER node`).
   - Use read-only root filesystems where possible, mounting persistent volumes or S3 storage for uploads.
3. **CORS Restrictions**:
   - Set `FRONTEND_URL=https://app.yourdomain.com` in production. Klavo will automatically reject requests from any other origin.

---

## 6. Outstanding Operational Limits
- **Custom SigV4 Client Testing**: `S3CompatibleStorageProvider` has been validated against in-memory S3 mocks. Before deploying to AWS S3, Cloudflare R2, or MinIO in production, run live staging smoke tests with target cloud credentials.
- **Multi-Instance State**: As documented in `DEPLOYMENT_STORAGE.md`, running multiple concurrent backend pods requires external Redis adapters for Socket.IO room fanout and Yjs CRDT synchronization.

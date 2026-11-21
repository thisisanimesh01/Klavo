# INT-01: Integrations, Webhooks & Developer Ecosystem Architecture

This document describes the architectural design, security boundaries, authentication models, delivery logging, and developer API references for Klavo's integration ecosystem.

---

## 1. Architectural Overview & System Components

Klavo's Developer Ecosystem is composed of four primary subsystems:
1. **Developer API Keys & Scoped Authentication**:
   - Enables headless programmatic interaction with Klavo REST APIs.
   - Guarded by cryptographically random 192-bit tokens (`klavo_live_<hex>`) stored using SHA-256 hashes (`keyHash`).
   - Granular permission scopes (`read:tasks`, `write:tasks`, `read:projects`, `write:projects`, `*`).
2. **Outbound Webhook Engine**:
   - Dispatches real-time event notifications (`task.created`, `task.updated`, `task.deleted`, etc.).
   - Signed using HMAC-SHA256 (`X-Klavo-Signature-256`).
   - Exponential backoff retry delivery with complete attempt auditing in `WebhookDeliveryLog`.
3. **Inbound Webhook Handlers (GitHub & Slack)**:
   - **GitHub**: Ingests repository commit pushes, pull requests, and branch deployments; securely verifies `X-Hub-Signature-256` signatures and links activities to project tasks.
   - **Slack**: Configures workspace-level alert channels and delivers asynchronous notifications with fallback isolation.
4. **Public REST API (v1)**:
   - Documented, versioned endpoints (`/api/v1/projects`, `/api/v1/projects/:projectId/tasks`) with standard sliding-window rate limiting (100 req/min).

---

## 2. Security & Tenancy Invariants

### 2.1 Credential Encryption at Rest (AES-256-GCM)
- All third-party secrets, tokens, and webhook secrets are stored encrypted using AES-256-GCM authenticated encryption (`backend/src/utils/cryptoHelpers.js`).
- Encrypted format: `IV(12 bytes) + AUTH_TAG(16 bytes) + CIPHERTEXT(variable)`.
- Tampering with ciphertext or authentication tag results in immediate authentication rejection.

### 2.2 Secret Redaction in Telemetry
- All logs and stored payload traces automatically redact sensitive keys (`token`, `secret`, `password`, `apiKey`, `authorization`, `encryptedCredentials`) via `redactSensitiveData`.

### 2.3 Workspace RBAC & Anti-IDOR
- Creating, revoking, or listing API keys and webhook subscriptions is strictly restricted to workspace **Owner** and **Administrator** roles via `checkTeamAccess` and `resolveWorkspaceRole`.
- Tenant isolation is enforced on every operation; cross-workspace data access returns `403 Forbidden`.

---

## 3. Public REST API Specification (v1)

### 3.1 Authentication
Authenticate requests using either of the following headers:
- `X-API-Key: klavo_live_<your_api_key>`
- `Authorization: Bearer klavo_live_<your_api_key>`

### 3.2 Endpoints

#### List Projects
- **Route**: `GET /api/v1/projects`
- **Scope Required**: `read:projects`
- **Response**:
```json
{
  "data": [
    {
      "id": "6b01...",
      "name": "Mobile Redesign",
      "teamId": "6b02...",
      "createdAt": "2026-11-21T18:00:00.000Z"
    }
  ]
}
```

#### List Project Tasks
- **Route**: `GET /api/v1/projects/:projectId/tasks?page=1&limit=20&status=todo`
- **Scope Required**: `read:tasks`
- **Response**:
```json
{
  "data": [
    {
      "id": "6b03...",
      "title": "Setup OAuth provider",
      "description": "Configure client credentials",
      "status": "todo",
      "priority": "high",
      "dueDate": "2026-11-30T00:00:00.000Z",
      "estimatedHours": 8,
      "labels": [{ "name": "backend", "color": "#6366f1" }]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### Create Task
- **Route**: `POST /api/v1/projects/:projectId/tasks`
- **Scope Required**: `write:tasks`
- **Payload**:
```json
{
  "title": "Implement rate limiting middleware",
  "description": "Add sliding window Redis limiter",
  "priority": "critical",
  "estimatedHours": 4
}
```

---

## 4. Webhook Signature Verification Guide

Each outbound webhook request includes the following verification headers:
- `X-Klavo-Event`: Name of the event (e.g. `task.created`).
- `X-Klavo-Delivery`: Unique delivery trace ID (`evt_...`).
- `X-Klavo-Timestamp`: Epoch timestamp in seconds.
- `X-Klavo-Signature-256`: `sha256=<hex_hmac_sha256_digest>`.

### Verification Example (Node.js)
```javascript
import crypto from "crypto";

function verifyKlavoWebhook(rawBody, signatureHeader, sharedSecret) {
  const expectedSig = "sha256=" + crypto
    .createHmac("sha256", sharedSecret)
    .update(rawBody)
    .digest("hex");

  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
```

---

## 5. Resilience & Outage Handling

- **Non-blocking Execution**: Outbound webhook dispatches and third-party notifications execute asynchronously. Failures in external endpoints or provider network outages never impede database transactions or block user task operations.
- **Delivery Logging**: All outbound deliveries log HTTP response status, execution duration, and attempt counts.
- **Backoff Retries**: Failed deliveries automatically retry with exponential backoff delays.

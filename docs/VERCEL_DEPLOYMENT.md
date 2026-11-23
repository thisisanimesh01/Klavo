# Klavo — Vercel Deployment & Continuous Deployment Guide

This guide details the complete deployment architecture for hosting Klavo on Vercel using the GitHub monorepo (`thisisanimesh01/Klavo`). It covers frontend SPA configuration, backend serverless API configuration, automated GitHub deployments, environment variable requirements, and technical constraints regarding real-time WebSockets and background schedulers.

---

## 1. Architecture Overview

Klavo uses a dual-project architecture on Vercel:

```
                      GitHub Monorepo (thisisanimesh01/Klavo)
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
        Frontend Vercel Project                 Backend Vercel Project
        Root Directory: frontend                Root Directory: backend
        Framework: Vite (React SPA)             Framework: Other (Express Serverless)
        URL: https://<frontend>.vercel.app      URL: https://<backend>.vercel.app
```

- **Continuous Deployment**: Both Vercel projects are connected directly to the `thisisanimesh01/Klavo` GitHub repository. Pushes to `main` automatically trigger production deployments; Pull Requests generate isolated preview deployments.
- **Independent CI**: GitHub Actions (`.github/workflows/ci.yml`) runs full test suites and security scans on PRs and merges, protecting `main` from broken builds.
- **GitHub Pages Safety**: The existing GitHub Pages workflow (`.github/workflows/deploy-pages.yml`) remains intact and operational until Vercel production deployment has been verified.

---

## 2. Milestone 2: Frontend Vercel Project Configuration

### Project Settings in Vercel Dashboard
- **Project Name**: `klavo-frontend` (or user-chosen name)
- **Framework Preset**: `Vite`
- **Root Directory**: `frontend` (crucial: check "Include source files outside of the Root Directory in the Build Step" if prompted)
- **Build Command**: `npm run build` (or leave default Vite detection)
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### SPA Fallback Routing (`frontend/vercel.json`)
The frontend contains `frontend/vercel.json` to handle client-side routing (React Router) across all deep paths (`/login`, `/dashboard`, `/projects/:id`, etc.):
```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Frontend Environment Variables (Build-Time)
Configure these in the Vercel Dashboard (**Settings > Environment Variables**) for the Frontend project:

| Variable Name | Environment | Required | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Production & Preview | **Yes** | Full URL of the backend API, e.g. `https://klavo-backend.vercel.app/api` |
| `VITE_BACKEND_URL` | Production & Preview | **Yes** | Root URL of backend (for sockets/assets), e.g. `https://klavo-backend.vercel.app` |
| `VITE_GOOGLE_CLIENT_ID` | Production & Preview | Optional | Google OAuth Web Client ID |
| `VITE_GITHUB_CLIENT_ID` | Production & Preview | Optional | GitHub OAuth App Client ID |

> **Security Note:** Vite bundles all `VITE_*` variables into client-side JS bundles. Never place backend secrets (`JWT_SECRET`, database credentials, API secret keys) into frontend environment variables.

---

## 3. Milestone 3: Backend Vercel Project Configuration

### Project Settings in Vercel Dashboard
- **Project Name**: `klavo-backend` (or user-chosen name)
- **Framework Preset**: `Other`
- **Root Directory**: `backend`
- **Build Command**: Leave empty / default
- **Output Directory**: Leave empty / default
- **Install Command**: `npm install`

### Serverless Routing (`backend/vercel.json`)
The backend routes all incoming requests to the Express serverless adapter at `backend/api/index.js`:
```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api/index.js"
    }
  ]
}
```

### Serverless Execution & Connection Pooling
- Entry point: `backend/api/index.js`
- Connects lazily using `connectDB(undefined, { serverless: true, noExit: true })`.
- Reuses global cached connection (`global.mongoose.conn`) across warm Lambda/Vercel invocations, preventing connection exhaustion.
- Never runs persistent `server.listen()`, preventing stuck functions or memory leaks.

### Health-Check Endpoints
- Liveness Probe: `GET /api/health/live` (fast 200 process check)
- Readiness Probe: `GET /api/health/ready` (verifies MongoDB ping and storage availability without leaking secrets)
- Standard Health: `GET /api/health`
- Aggregated Metrics: `GET /api/health/metrics`

### Backend Environment Variables
Configure these in the Vercel Dashboard (**Settings > Environment Variables**) for the Backend project:

| Variable Name | Required | Example / Description |
| :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | Set to `production` |
| `MONGO_URI` | **Yes** | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `JWT_SECRET` | **Yes** | High-entropy secret key (at least 32 characters in production) |
| `FRONTEND_URL` | **Yes** | Production frontend domain, e.g. `https://klavo-frontend.vercel.app` |
| `ALLOWED_ORIGINS` | **Yes** | Comma-delimited origins, e.g. `https://klavo-frontend.vercel.app,https://thisisanimesh01.github.io` |
| `TRUST_PROXY` | **Yes** | Set to `true` (enables Express trust proxy for Vercel edge reverse proxy) |
| `COOKIE_SECURE` | Optional | Set to `true` for production HTTPS cookies |
| `STORAGE_PROVIDER` | Optional | `local` (falls back to `/tmp/uploads` on serverless) or `s3` |
| `S3_BUCKET` | If S3 | AWS S3 Bucket Name for persistent file storage |
| `S3_REGION` | If S3 | AWS S3 Region |
| `S3_ACCESS_KEY_ID` | If S3 | AWS S3 IAM Access Key |
| `S3_SECRET_ACCESS_KEY` | If S3 | AWS S3 IAM Secret Key |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 Client ID |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth 2.0 Client ID |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth 2.0 Client Secret |

---

## 4. Milestone 4: Real-Time & Background Architecture Analysis

Vercel Serverless Functions execute on demand in ephemeral container instances and freeze or terminate immediately when an HTTP response is returned.

### Capability Matrix: Vercel Serverless vs. Persistent Node.js

| Capability | Vercel Serverless (`backend/api/index.js`) | Persistent Server / Docker (`backend/src/index.js`) |
| :--- | :--- | :--- |
| **REST APIs & CRUD** | Fully Supported | Fully Supported |
| **Authentication & JWT** | Fully Supported (Stateless tokens) | Fully Supported |
| **MongoDB Operations** | Fully Supported (Connection pool caching) | Fully Supported |
| **WebSockets (Socket.IO)** | **Not Supported** (Ephemeral instances cannot maintain TCP sockets) | **Fully Supported** (Stateful persistent WebSockets) |
| **Yjs CRDT Document Sync** | **Not Supported** (Requires active WebSocket coordinator) | **Fully Supported** (In-memory + Redis cross-pod sync) |
| **Recurring Task Scheduler** | **Unsupported In-Process** (`setInterval` freezes on request completion) | **Fully Supported** (In-process cron engine with Redis locks) |
| **Automated DB Backups** | **Unsupported In-Process** | **Fully Supported** (`backupScheduler`) |

### Impact on Klavo User Experience on Vercel
1. **Frontend Graceful Degradation**:
   - Klavo's frontend data architecture is built on standard REST endpoints (`axiosClient`). Tasks, documents, comments, settings, sprints, and automations operate reliably via HTTP.
   - Socket connections in `frontend/src/socket.js` have `autoConnect: false`. When sockets are unavailable or disconnected, the application functions cleanly without UI crashes; users refresh or perform actions to view real-time state changes.
2. **Collaborative Editor (TipTap / Documents)**:
   - Document editing saves content reliably via HTTP REST (`/api/documents`).
   - Simultaneous multi-cursor collaborative editing (live typing markers across users) is disabled when disconnected from a persistent WebSocket server.
3. **Recurring Task Automation**:
   - On Vercel, in-process `setInterval` cannot run.
   - **Solution**: Use Vercel Cron or an external cron service (such as GitHub Actions scheduled workflow or cron-job.org) hitting the project recurring trigger endpoint or an external task runner.
   - In addition, users can manually trigger recurring tasks via the UI (`POST /api/automations/recurring/:recurringId/trigger`).

### Long-Term Production Alternatives for Full Real-Time
To unlock 100% of Klavo's real-time collaborative capabilities alongside Vercel:
- **Hybrid Architecture (Recommended)**:
  - Deploy **Frontend on Vercel** (global edge CDN, instant preview deployments, low latency).
  - Deploy **Backend on Render, Fly.io, Railway, or AWS ECS/Fargate** running `node backend/src/index.js` (enables persistent Socket.IO, Yjs collaboration, Redis coordinator, and continuous background timers).
- **Managed Real-time Services**:
  - Migrate Yjs collaboration to Liveblocks or PartyKit, or migrate notifications to Pusher / Ably.

---

## 5. Milestone 5: Automated GitHub Deployments

### Vercel Git Integration
Vercel connects directly to the GitHub repository (`thisisanimesh01/Klavo`):
1. **Production Branch**: Any pull request merged into `main` automatically triggers a production build in both the frontend and backend Vercel projects (filtered by root directory).
2. **Preview Deployments**: Opening a Pull Request automatically deploys an isolated preview deployment with a unique preview URL and comments on the PR.
3. **Monorepo Directory Filtering**:
   - In Vercel Project Settings > Git:
     - Frontend project watches `frontend/`
     - Backend project watches `backend/`
   - Changes affecting only the frontend will not trigger an unnecessary backend rebuild and vice versa.

### CI Gating Workflow (`.github/workflows/ci.yml`)
The repository's automated CI workflow runs on every pull request targeting `main`:
- `backend-tests`: Runs unit and integration tests (`node --test backend/tests/*.test.js`), secret scanning (`scripts/scan_secrets.js`), and preflight validation.
- `frontend-checks`: Runs frontend tests (`node --test frontend/tests/*.test.js`) and production bundle build (`npm run build`).
- `e2e-tests`: Runs Playwright E2E browser test suite against MongoDB.

If any test or build fails, GitHub branch protection blocks merging into `main`, preventing broken code from deploying to Vercel production.

### GitHub Pages Coexistence
The GitHub Pages deployment workflow (`.github/workflows/deploy-pages.yml`) remains intact. Users can safely verify Vercel production hosting before choosing to retire GitHub Pages.

---

## 6. MongoDB Atlas Setup Requirements

1. **Network Access / IP Whitelisting**:
   - Vercel Serverless Functions use dynamic IP addresses across AWS regions.
   - In MongoDB Atlas: Go to **Network Access** > **Add IP Address** > Choose **Allow Access from Anywhere** (`0.0.0.0/0`) or configure AWS Peering / PrivateLink if on enterprise tiers.
2. **Database User Credentials**:
   - Create a dedicated database user with `readWrite` permissions on the `klavo` database.
3. **Connection String Parameters**:
   - Use standard SRV format: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/klavo?retryWrites=true&w=majority`
   - Vercel serverless adapter automatically sets `maxPoolSize: 10`, `serverSelectionTimeoutMS: 5000`, and `socketTimeoutMS: 45000`.

---

## 7. OAuth Provider Configuration (Google & GitHub)

When deploying to Vercel production domains, update authorized OAuth redirect origins:

### Google Cloud Console (Google OAuth)
1. Go to **Google Cloud Console > APIs & Services > Credentials**.
2. Select your Web Application OAuth 2.0 Client ID.
3. Under **Authorized JavaScript origins**, add:
   - `https://<frontend-project>.vercel.app`
   - Any custom domain (e.g., `https://app.klavo.com`)
4. Under **Authorized redirect URIs**, add:
   - `https://<frontend-project>.vercel.app`

### GitHub Developer Settings (GitHub OAuth)
1. Go to **GitHub Settings > Developer settings > OAuth Apps**.
2. Select your OAuth Application.
3. Set **Homepage URL**: `https://<frontend-project>.vercel.app`
4. Set **Authorization callback URL**: `https://<frontend-project>.vercel.app/oauth/github/callback`

---

## 8. Step-by-Step Manual Actions to Complete in Vercel

To complete production deployment:

### Step 1: Create Frontend Project on Vercel
1. Log in to [vercel.com](https://vercel.com) and click **Add New > Project**.
2. Import the Git repository `thisisanimesh01/Klavo`.
3. In the configuration screen:
   - **Project Name**: `klavo-frontend`
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click "Edit" and choose `frontend`.
4. Expand **Environment Variables** and add:
   - `VITE_API_URL`: `https://<your-backend-project>.vercel.app/api`
   - `VITE_BACKEND_URL`: `https://<your-backend-project>.vercel.app`
   - `VITE_GOOGLE_CLIENT_ID`: (Your Google Client ID, if using Google Auth)
   - `VITE_GITHUB_CLIENT_ID`: (Your GitHub Client ID, if using GitHub Auth)
5. Click **Deploy**.

### Step 2: Create Backend Project on Vercel
1. Click **Add New > Project**.
2. Import `thisisanimesh01/Klavo` again.
3. In the configuration screen:
   - **Project Name**: `klavo-backend`
   - **Framework Preset**: `Other`
   - **Root Directory**: Click "Edit" and choose `backend`.
4. Expand **Environment Variables** and add:
   - `NODE_ENV`: `production`
   - `MONGO_URI`: (Your MongoDB Atlas connection string)
   - `JWT_SECRET`: (Minimum 32-character random string)
   - `FRONTEND_URL`: `https://klavo-frontend.vercel.app` (the production URL from Step 1)
   - `ALLOWED_ORIGINS`: `https://klavo-frontend.vercel.app,https://thisisanimesh01.github.io`
   - `TRUST_PROXY`: `true`
5. Click **Deploy**.

### Step 3: Link Frontend to Backend URL
- Once the backend is deployed, copy its production domain (e.g., `https://klavo-backend.vercel.app`).
- Return to the `klavo-frontend` project in Vercel.
- Under **Settings > Environment Variables**, ensure `VITE_API_URL` is set to `https://klavo-backend.vercel.app/api` and `VITE_BACKEND_URL` is set to `https://klavo-backend.vercel.app`.
- Trigger a redeployment of the frontend under **Deployments > Redeploy** so Vite injects the backend URL during build.

### Step 4: Verify Live Endpoints
- Test backend health: `curl https://<your-backend>.vercel.app/api/health/ready`
- Test frontend login and registration in browser: `https://<your-frontend>.vercel.app/register`

### Step 5: Rollback Instructions
If an unexpected regression occurs in production:
1. In the Vercel Dashboard for either project, navigate to **Deployments**.
2. Locate the previous working deployment.
3. Click the three dots (`...`) menu and select **Instant Rollback** (or **Promote to Production**).
4. Vercel routes traffic immediately to the previous deployment artifact with zero downtime.

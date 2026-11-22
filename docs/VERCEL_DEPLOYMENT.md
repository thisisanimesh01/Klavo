# Klavo Deployment Guide: Vercel Serverless & Persistent Backend

This guide outlines deployment options for Klavo, detailing architecture compatibility, serverless constraints on Vercel, and configurations for local development versus production.

---

## 1. Deployment Models Overview

Klavo supports two backend execution paradigms:

| Capability | Vercel Serverless (`api/index.js`) | Persistent Node.js / Docker Server (`src/index.js`) |
| :--- | :--- | :--- |
| **REST / HTTP APIs** | Supported | Supported |
| **Authentication & OAuth** | Supported (Stateless JWT) | Supported (Stateless JWT) |
| **CRUD & Database Operations** | Supported (Mongoose connection pool reuse) | Supported (Persistent Mongoose connection) |
| **WebSockets (Socket.IO)** | **Not Recommended / Highly Constrained** (Ephemeral functions, horizontal scaling disconnects) | **Fully Supported** (Persistent stateful connections) |
| **Real-time Yjs CRDT Document Sync** | **Requires Persistent Coordinator** | **Fully Supported** (via `redisCoordinator` + memory rooms) |
| **User Presence & Live Typing** | **Isolated per serverless instance** | **Fully Supported** (In-memory + Redis cross-pod sync) |
| **Recurring Task Automations** | **Unsupported in-process** (No long-lived `setInterval`) | **Fully Supported** (In-process cron engine with Redis locks) |
| **Automated Database Backups** | **Unsupported in-process** | **Fully Supported** (`backupScheduler`) |

---

## 2. Vercel Serverless Deployment (Stateless API Tier)

When deploying Klavo backend on Vercel:

### Directory Structure & Routing
- Entry Point: `backend/api/index.js`
- Configuration: `backend/vercel.json` (or root `vercel.json`)
- The serverless handler lazily connects to MongoDB using cached connection pooling (`serverless: true`), dispatches requests through the standard Express app (`createApp()`), and exits cleanly.
- `server.listen()`, Socket.IO listeners, Redis TCP subscribers, and in-memory schedulers are intentionally omitted to prevent dangling sockets and memory leaks in ephemeral execution contexts.

### Required Environment Variables on Vercel
Set the following environment variable names in the Vercel Dashboard (**Settings > Environment Variables**):
- `NODE_ENV`: `production`
- `MONGO_URI`: MongoDB connection string (e.g. MongoDB Atlas `mongodb+srv://...`)
- `JWT_SECRET`: Minimum 32-character secure secret
- `FRONTEND_URL`: Deployed frontend origin (e.g., `https://thisisanimesh01.github.io`)
- `ALLOWED_ORIGINS`: Comma-delimited origins including `https://thisisanimesh01.github.io`
- `GOOGLE_CLIENT_ID`: (Optional) Google OAuth Client ID
- `GITHUB_CLIENT_ID`: (Optional) GitHub OAuth Client ID
- `GITHUB_CLIENT_SECRET`: (Optional) GitHub OAuth Client Secret

### Limitations of Vercel Serverless
1. **Background Tasks & Automations:** Ephemeral functions freeze immediately upon request completion. In-process timers (`setInterval` in `recurringScheduler.js`) do not execute. To trigger automated tasks, configure an external scheduler (e.g., GitHub Actions workflow or a cron service) to hit a protected webhook endpoint.
2. **Real-time Collaboration & Sockets:** Socket.IO clients on Vercel connect to isolated serverless instances. Multi-client collaborative editing (TipTap editor CRDTs) and live presence updates require persistent WebSocket servers.
3. **Connection Limits:** Set `MONGO_MAX_POOL_SIZE` appropriately (e.g., `10`) to prevent serverless auto-scaling bursts from exhausting database connection limits.

---

## 3. Persistent Server Deployment (Full Feature Set)

For complete real-time document collaboration, live user presence, distributed coordination, and in-process background scheduling:

### Local Development
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

### Production Docker / VM Deployment
Use the standard entry point:
```bash
node backend/src/index.js
```
or launch via Docker Compose:
```bash
docker-compose -f docker-compose.yml up -d
```
All capabilities (WebSockets, Yjs documents, recurring task loops, and Redis clustering) will run as intended.

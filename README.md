# Klavo

Klavo is a modern, real-time project management and collaborative document platform combining Kanban workflows, CRDT-backed rich text editing, automated task engines, and enterprise access controls.

## Live Application

- **Production Workspace**: [https://klavoworkspace.vercel.app](https://klavoworkspace.vercel.app)
- **Production API**: [https://klavo-backend.vercel.app/api/health](https://klavo-backend.vercel.app/api/health)
- **GitHub Pages Mirror**: [https://thisisanimesh01.github.io/Klavo/](https://thisisanimesh01.github.io/Klavo/)

## System & Website Working Diagram

The following diagram illustrates how user interactions, authentication flows, real-time sync, and data operations interact across the Klavo platform:

```mermaid
flowchart TD
    %% User entry and client layer
    subgraph Users["End Users & Teams"]
        Browser["User Browser\n(https://klavoworkspace.vercel.app)"]
    end

    subgraph ClientApp["Frontend Single Page App (Vercel)"]
        Router["React Router\n(/login, /dashboard, /projects, /wiki)"]
        AuthUI["Modern Auth UI\n(Email/Password, Google, GitHub)"]
        State["Redux Toolkit Store\n(Auth, Tasks, Sprints, UI State)"]
        CollabUI["Tiptap Editor + Canvas\n(Rich Text & Kanban)"]
    end

    subgraph Identity["Identity & OAuth Providers"]
        Google["Google Cloud OAuth 2.0\n(OpenID Connect)"]
        GitHub["GitHub OAuth App\n(Authorize & User Email)"]
    end

    subgraph EdgeTier["Vercel Serverless Edge API Tier"]
        ApiGateway["Vercel Serverless Function\n(/api/* -> api/index.js)"]
        AuthModule["Auth & JWT Gate\n(Cookie & Bearer Tokens)"]
        Controllers["Express Business Logic\n(Tasks, Projects, Analytics, Teams)"]
        HealthModule["Health & Diagnostics\n(/api/health, /api/health/ready)"]
    end

    subgraph RealtimeTier["Stateful Collaboration Tier (Node.js/Docker)"]
        SocketServer["Socket.IO Server\n(Presence & Cursor Sync)"]
        CRDTServer["Yjs Document Room\n(Conflict-Free Replicated Data)"]
        CronEngine["Workflow Automation Engine\n(Recurring Tasks & Triggers)"]
    end

    subgraph StorageTier["Persistent Data & Cache Tier"]
        Mongo[(MongoDB Atlas Cluster\nUsers, Projects, Tasks, Docs)]
        Redis[(Redis Cloud / Cache\nPub/Sub & Distributed Locks)]
    end

    %% Flow connections
    Browser --> Router
    Router --> AuthUI
    Router --> CollabUI

    AuthUI -->|OAuth Login| Google
    AuthUI -->|OAuth Login| GitHub
    Google -->|Callback Token| AuthUI
    GitHub -->|Callback Code| AuthUI

    AuthUI -->|REST: /api/auth/*| ApiGateway
    CollabUI -->|State Dispatch| State
    State -->|REST: /api/*| ApiGateway

    ApiGateway --> AuthModule
    AuthModule --> Controllers
    ApiGateway --> HealthModule

    Controllers -->|Mongoose Pool| Mongo

    CollabUI <-->|WebSockets: wss://| SocketServer
    SocketServer <--> CRDTServer
    CRDTServer <--> Redis
    CronEngine <--> Mongo
    CronEngine <--> Redis
```

## Architectural Highlights

- **Vercel Serverless REST API**: Zero-maintenance serverless execution with pooled MongoDB Atlas connections.
- **Client-Side SPA Routing**: Instant navigation with React Router and Vercel rewrite rules avoiding 404s.
- **Enterprise Collaboration**: Dual-mode real-time architecture with Yjs CRDTs for non-blocking collaborative document writing and live board updates.
- **Multi-Provider OAuth**: Frictionless sign-in with Google, GitHub, and corporate SSO alongside secure salted bcrypt email authentication.

## Tech Stack

- **Frontend**: React 18, Vite, Redux Toolkit, Tailwind CSS, Tiptap, Lucide Icons
- **Backend**: Node.js, Express, Socket.IO, Yjs CRDTs, Mongoose
- **Databases & Cache**: MongoDB Atlas, Redis (Pub/Sub & Distributed Locks)
- **Authentication**: JWT Cookies, Google Sign-In, GitHub OAuth, SAML / OIDC SSO
- **Deployment & Hosting**: Vercel (Frontend & Serverless API), Docker / Cloud Containers (WebSockets & Real-time Sync), GitHub Pages (Mirror)
- **Quality & Testing**: Node.js Native Test Runner, Playwright E2E, Automated Secret Scans

## Local Development

### Prerequisites
- Node.js >= 20
- MongoDB 6.0+

### Setup

```bash
# Clone repository
git clone https://github.com/thisisanimesh01/Klavo.git
cd Klavo

# Install all dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Running Locally

```bash
# Terminal 1: Start Backend (Port 5050)
cd backend && npm run dev

# Terminal 2: Start Frontend (Port 5173)
cd frontend && npm run dev
```

Visit `http://localhost:5173`.

## Testing

```bash
# Backend unit & integration test suite
node --test backend/tests/*.test.js

# Frontend test suite
node --test frontend/tests/*.test.js

# Playwright End-to-End tests
npx playwright test

# Secret leak scan
node scripts/scan_secrets.js
```

## Documentation

Full architectural guides and specifications:
- [Vercel Serverless Deployment Guide](docs/VERCEL_DEPLOYMENT.md)
- [Enterprise Architecture](docs/ENTERPRISE_ARCHITECTURE.md)
- [Real-Time Collaboration](docs/COLLABORATION.md)
- [Automation Engine](docs/AUTOMATION_ARCHITECTURE.md)
- [Integrations & Webhooks](docs/INTEGRATIONS_ARCHITECTURE.md)

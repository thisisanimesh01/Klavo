# Klavo

Klavo is a modern, real-time project management and collaborative document platform combining Kanban workflows, CRDT-backed rich text editing, automated task engines, and enterprise access controls.

## Live Application

- **Production Workspace**: [https://klavoworkspace.vercel.app](https://klavoworkspace.vercel.app)
- **Production API**: [https://klavo-backend.vercel.app/api/health](https://klavo-backend.vercel.app/api/health)
- **GitHub Pages Mirror**: [https://thisisanimesh01.github.io/Klavo/](https://thisisanimesh01.github.io/Klavo/)

## System Architecture & Workflow

The following diagram illustrates how user interactions, authentication flows, real-time sync, and data operations interact across the Klavo platform:

<div align="center">

```mermaid
graph TD
    classDef client fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#ffffff;
    classDef auth fill:#172554,stroke:#3b82f6,stroke-width:2px,color:#ffffff;
    classDef edge fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#ffffff;
    classDef realtime fill:#581c87,stroke:#a855f7,stroke-width:2px,color:#ffffff;
    classDef storage fill:#3b0764,stroke:#ec4899,stroke-width:2px,color:#ffffff;

    subgraph ClientLayer["🖥️ Frontend Client Tier (Vercel SPA)"]
        Browser["User Browser<br/>(klavoworkspace.vercel.app)"]
        Router["React Router<br/>(Dashboard, Kanban, Wiki, Settings)"]
        AuthUI["Modern Auth UI<br/>(Email/Password, Google, GitHub)"]
        State["Redux Toolkit Store<br/>(Global Application State)"]
        Editor["Tiptap Editor & Kanban Canvas<br/>(Rich Text & Agile Boards)"]
    end

    subgraph IdentityLayer["🔐 OAuth 2.0 & Identity Providers"]
        Google["Google Cloud OAuth<br/>(OpenID Connect / Profile)"]
        GitHub["GitHub OAuth App<br/>(Authorize & User Email)"]
    end

    subgraph ServerlessLayer["⚡ Edge API Tier (Vercel Serverless Express)"]
        ApiGateway["Vercel Serverless Function Handler<br/>(/api/* ➔ Express App)"]
        AuthGuard["Auth Middleware & JWT Validation<br/>(HTTP-Only Cookie / Bearer Token)"]
        Controllers["Domain Controllers<br/>(Tasks, Sprints, Analytics, Automations)"]
    end

    subgraph RealtimeLayer["🔄 Stateful Collaboration Tier (Node.js / Docker)"]
        SocketServer["Socket.IO Server<br/>(Realtime Presence & Cursor Awareness)"]
        CRDTRoom["Yjs Document Room<br/>(CRDT Conflict-Free State Sync)"]
        AutomationCron["Automation Engine<br/>(Recurring Triggers & Scheduled Jobs)"]
    end

    subgraph StorageLayer["💾 Persistent Data & Cache Tier"]
        MongoAtlas[("MongoDB Atlas Cloud Database<br/>Users, Projects, Workspaces, Docs")]
        RedisCache[("Redis Cloud Cluster<br/>Pub/Sub Broker & Distributed Locks")]
    end

    %% Client Interactions
    Browser --> Router
    Router --> AuthUI
    Router --> Editor

    %% OAuth Flows
    AuthUI -.->|OAuth Authenticate| Google
    AuthUI -.->|OAuth Authenticate| GitHub
    Google -.->|Token / Identity Payload| AuthUI
    GitHub -.->|Callback Auth Code| AuthUI

    %% API REST Connections
    AuthUI -->|POST /api/auth/*| ApiGateway
    Editor -->|State Mutations| State
    State -->|HTTP REST Requests| ApiGateway

    ApiGateway --> AuthGuard
    AuthGuard --> Controllers
    Controllers -->|Pooled Mongoose Driver| MongoAtlas

    %% Real-time Socket & CRDT Connections
    Editor <==>|Secure WSS Connection| SocketServer
    SocketServer <==> CRDTRoom
    CRDTRoom <==> RedisCache
    AutomationCron <==> MongoAtlas
    AutomationCron <==> RedisCache

    class Browser,Router,AuthUI,State,Editor client;
    class Google,GitHub auth;
    class ApiGateway,AuthGuard,Controllers edge;
    class SocketServer,CRDTRoom,AutomationCron realtime;
    class MongoAtlas,RedisCache storage;
```

</div>

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

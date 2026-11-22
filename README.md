# Klavo

Klavo is a collaborative project management and real-time document platform built with Node.js, React, MongoDB, and Yjs CRDTs.

## Features

- **Authentication**: Email/password, Google Sign-In, GitHub OAuth, and enterprise SAML/OIDC SSO support.
- **Project Management**: Kanban boards, customizable statuses, sprint lifecycles, milestones, priorities, labels, and dependencies.
- **Real-Time Collaboration**: Collaborative rich-text documents powered by Yjs CRDTs, live presence, cursor awareness, and wikis.
- **Automation & Integrations**: Multi-condition workflow automation, outbound webhooks with HMAC signatures, and public REST APIs.
- **AI Tools**: Natural language task extraction, automated task breakdown, risk detection, and velocity tracking.
- **Enterprise Controls**: Multi-tenant organizations, custom roles and permissions, and cryptographic audit logs.

## Tech Stack

- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.IO, Yjs, Redis.
- **Frontend**: React, Vite, Redux Toolkit, Tailwind CSS, Tiptap.
- **Testing**: Node.js Test Runner, Playwright.

## Getting Started

### Prerequisites

- Node.js >= 20
- MongoDB 6.0+

### Installation

```bash
git clone https://github.com/thisisanimesh01/Klavo.git
cd Klavo

# Install dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Environment Setup

#### `backend/.env`
```env
PORT=5050
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/klavo
JWT_SECRET=your_jwt_secret_32_characters_minimum
FRONTEND_URL=http://localhost:5173

# Optional OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

#### `frontend/.env`
```env
VITE_API_URL=http://localhost:5050/api
VITE_BACKEND_URL=http://localhost:5050

# Optional OAuth
VITE_GOOGLE_CLIENT_ID=
VITE_GITHUB_CLIENT_ID=
```

### Running Locally

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

App runs at `http://localhost:5173`.

## Testing

```bash
# Backend unit & integration tests
node --test backend/tests/*.test.js

# Frontend tests
node --test frontend/tests/*.test.js

# End-to-end tests
npx playwright test

# Secret leak scan
node scripts/scan_secrets.js
```

## Documentation

Full architectural documentation is available in the [`docs/`](docs/) directory:
- [Enterprise Architecture](docs/ENTERPRISE_ARCHITECTURE.md)
- [Real-Time Collaboration](docs/COLLABORATION.md)
- [Automation Engine](docs/AUTOMATION_ARCHITECTURE.md)
- [Integrations & Webhooks](docs/INTEGRATIONS_ARCHITECTURE.md)
- [Scalability & Reliability](docs/SCALABILITY_RELIABILITY.md)

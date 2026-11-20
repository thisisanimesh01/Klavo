# Klavo Automated Testing & CI Foundation (TEST-01)

This document describes the automated test architecture, test execution commands, fixtures, and GitHub Actions continuous integration pipeline for Klavo.

---

## 1. Test Architecture

Klavo utilizes the native **Node.js test runner** (`node:test` and `node:assert/strict`), providing sub-second execution, zero additional runtime overhead, and zero third-party vulnerability exposure.

```
backend/tests/
  ├── fixtures/
  │    └── mockData.js               # Reusable test fixtures (users, teams, projects, tasks)
  ├── auth.test.js                   # SEC-01: Bcrypt password hashing & legacy migration tests
  ├── env.test.js                    # SEC-02: Fail-fast environment validation tests
  ├── authorization.test.js          # SEC-03: RBAC & cross-tenant IDOR protection tests
  ├── sessionStability.test.js       # STAB-01: Session corruption & 401 interceptor tests
  └── routesNavigation.test.js       # ROUT-01: Route mounting & sidebar parity tests

frontend/tests/
  └── components.test.js             # Frontend Redux state, Topbar resolution & theme tests
```

---

## 2. Running Tests Locally

### Run All Backend & Security Tests:
```bash
MONGO_URI="mongodb://localhost:27017/test" JWT_SECRET="test_secret" node --test backend/tests/*.test.js
```

### Run Frontend Component Tests:
```bash
node --test frontend/tests/*.test.js
```

### Run Full Test Suite:
```bash
MONGO_URI="mongodb://localhost:27017/test" JWT_SECRET="test_secret" node --test backend/tests/*.test.js frontend/tests/*.test.js
```

### Run Frontend Production Build Check:
```bash
cd frontend && npm run build
```

---

## 3. Continuous Integration (CI)

A GitHub Actions workflow is defined in `.github/workflows/ci.yml`. It triggers automatically on all pull requests and pushes to `main`.

### Pipeline Jobs:
1. **`backend-tests`**:
   - Environment: Node.js 20 on Ubuntu Latest.
   - Installs backend dependencies via `npm ci`.
   - Injects mock CI credentials (`MONGO_URI`, `JWT_SECRET`).
   - Executes all test files under `backend/tests/`.
2. **`frontend-checks`**:
   - Environment: Node.js 20 on Ubuntu Latest.
   - Installs frontend dependencies via `npm ci`.
   - Executes unit tests under `frontend/tests/`.
   - Validates Vite production bundle compilation via `npm run build`.

---

## 4. Integration Test Architecture (REL-01)

### Backend HTTP & Socket Integration
- **`backend/src/app.js`**: Decouples the Express application factory (`createApp`) from the network socket listener (`server.listen()`). This allows in-memory integration testing of all routes and middleware layers without spinning up external listening ports or connecting to external live databases.
- **`backend/tests/helpers/testServer.js`**: Provides `dispatchRequest()`, which pipes native Node.js `IncomingMessage` and `ServerResponse` streams through the complete Express middleware stack (CORS, body parsing, cookie parsing, router routes, and centralized 404/500 error handlers).
- **`backend/tests/httpPipeline.test.js`**: Verifies real HTTP request/response flows, CORS preflights, unmounted 404 handling, missing Authorization tokens, malformed headers, and payload validation (registration, login, teams, projects, tasks, documents, analytics, and onboarding).
- **`backend/tests/socketIntegration.test.js`**: Tests Socket.IO connection authentication via auth payload and Bearer header, private user notification room isolation, and role-authorized team/project room joining.

### Frontend API Client & State Integration
- **`frontend/tests/rel01_integration.test.js`**: Tests the end-to-end integration between asynchronous actions, Redux slices (`auth`, `notifications`, `onboarding`), state hydration, credential clearing on logout, real-time unread count updates, and milestone deduplication.

### Running Integration Tests
```bash
node --test backend/tests/httpPipeline.test.js backend/tests/socketIntegration.test.js frontend/tests/rel01_integration.test.js
```

---

## 5. End-to-End Workflow Testing (REL-02)

Klavo implements a comprehensive browser-based E2E testing architecture powered by **Playwright**, testing real user workflows across Desktop Chromium and Mobile Chromium.

### Architecture & Key Components
- **`playwright.config.js`**:
  - Deterministic single-worker test runner (`workers: 1`) to eliminate database state races.
  - Device profiles: Desktop Chromium (1280x800) and Mobile Chromium (Pixel 5 viewport).
  - Diagnostic capture: Traces (`retain-on-failure`), Screenshots (`only-on-failure`), and Videos (`retain-on-failure`).
- **`e2e/fixtures/testEnvironment.js`**:
  - `startUnifiedTestServer()`: Launches an in-process HTTP server serving both the frontend production bundle (`frontend/dist`) and backend Express API under the same origin.
  - Automatically establishes connection to the isolated local MongoDB instance.
  - Ensures clean teardown and ephemeral port binding.

### Test Suites
- **`e2e/auth-session.spec.js`**:
  - User registration, login with credentials, and session persistence across page reloads.
  - Topbar user greeting and logout redirection.
  - Dialog-intercepted validation error on invalid login credentials.
  - Unauthenticated access redirects.
- **`e2e/workspaces-projects-tasks.spec.js`**:
  - Workspace/team creation and member directory listing.
  - Project creation within workspace tenancy.
  - Project Kanban board loading, columns verification (`Todo`, `In Progress`, `Done`), and view navigation (`Product Backlog`, `Milestones & Gantt`).
- **`e2e/documents-collab.spec.js`**:
  - Project workspace navigation to real-time documents editor (`/documents/:projectId`).
  - Action button verification for new documents and folders.
  - Project wiki knowledge base navigation (`/wiki/:projectId`).
- **`e2e/analytics-onboarding-responsive.spec.js`**:
  - Dashboard analytics stats and onboarding checklist progress tracking (`0/5 completed`).
  - Global Command Palette modal interaction (Cmd+K / search trigger button and Escape dismissal).
  - Project Analytics Dashboard inspection (`/analytics`).
  - Mobile viewport responsive navigation drawer toggle.
- **`e2e/collaboration-notifications-files.spec.js`**:
  - Cross-feature navigation through Calendar (`/calendar`) and task due dates.
  - Persistent object storage file repository (`/files`), project selector, and file upload controls.
  - Real-time Notifications drawer toggle via Topbar.
  - Workspace settings (`/settings`), user profile inspection, and workspace management tabs.
- **`e2e/analytics-exports-automation.spec.js`**:
  - Automated rule workflows & recurring tasks modal on project boards.
  - Detailed analytics metrics, charts, and report groupings.
  - RFC 4180 CSV and formatted PDF export actions.

### Running Playwright E2E Tests
```bash
# Run all E2E tests across Desktop and Mobile Chromium
npx playwright test

# Run a specific suite
npx playwright test e2e/auth-session.spec.js

# View HTML Test Report
npx playwright show-report
```

---

## 6. Complete End-to-End CI Pipeline (REL-12)

The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) executes on every push and pull request to `main`:
1. **`backend-tests`**: Runs all unit, integration, secret regression, and production preflight checks.
2. **`frontend-checks`**: Runs frontend Redux, component, and accessibility test suites, followed by full Vite production bundle compilation.
3. **`e2e-tests`**:
   - Boots an isolated containerized MongoDB service (`mongo:6.0`).
   - Installs Playwright Chromium binaries with OS-level dependencies.
   - Compiles the frontend production bundle and starts the unified test server.
   - Executes all 16 Playwright journeys across Desktop Chromium and Mobile Chromium.
   - Uploads HTML test reports, failure screenshots, and execution traces as a 14-day retained artifact upon test completion or regression.

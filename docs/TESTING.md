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

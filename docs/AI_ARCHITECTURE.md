# AI-01: AI-Powered Project Management & Intelligent Automation Architecture

This document describes the architectural design, security boundaries, multi-tier provider integration, prompt defense mechanisms, and user approval workflows for AI-driven project management features in Klavo.

---

## 1. Architectural Overview & Design Principles

Klavo's AI capabilities are designed around four foundational principles:
1. **Multi-Tier Extensibility with Safe Fallback**: Support production enterprise LLM APIs (OpenAI, Anthropic, Gemini) with zero hard cloud dependencies by default. Out of the box, Klavo operates with a high-performance, deterministic `RuleBasedFallbackProvider` that executes 100% offline without network egress or API keys.
2. **Tenant Isolation & Anti-IDOR Enforcement**: Every AI request is guarded by strict workspace and project RBAC checks (`checkProjectAccess` and `checkTaskAccess`). Context injection only queries data within the caller's authorized workspace and project scope.
3. **Non-Destructive Execution (Human-in-the-Loop)**: AI never directly mutates or deletes database records. Instead, recommendations, structured extractions, and breakdowns are returned as proposals or pre-filled forms that require explicit user review and confirmation before submission.
4. **Prompt Injection & Data Sanitization**: All user inputs undergo input sanitation, instruction-override pattern neutralization, character stripping, and length bounding before processing or passing to any LLM engine.

---

## 2. Multi-Tier Provider Integration

The AI subsystem is managed by `AIServiceCoordinator` (`backend/src/services/aiService.js`) and configured via validated environment variables (`backend/src/config/env.js`):

| Variable | Type | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | `String` | `"mock"` | Provider engine: `"mock"`, `"openai"`, `"anthropic"`, or `"gemini"`. |
| `AI_API_KEY` | `String` | `""` | Optional API key for external providers. Never required for tests or offline operation. |
| `AI_MODEL` | `String` | `""` | Optional provider-specific model identifier. |
| `AI_BASE_URL` | `String` | `""` | Optional custom base URL for private or proxy deployments. |

### Fallback Engine (`RuleBasedFallbackProvider`)
When `AI_PROVIDER` is unset or set to `"mock"` (or if an external provider call encounters a network failure), the system falls back seamlessly to the built-in deterministic heuristic provider. This provider implements:
- **Regex & NLP entity extraction** for title, priorities (`urgent`, `critical`, `high`, `medium`, `low`), relative dates (`today`, `tomorrow`, `next week`, `in X days`), estimated hours, and tags (`#tag`).
- **Standardized template breakdowns** for common development patterns (APIs, UI components, database migrations, security patches, refactoring).
- **Metric-driven project health calculations** for completion velocities, overdue tasks, unassigned bottlenecks, and critical paths.
- **Context-grounded query answering** searching workspace project data strictly for factual answers (task counts, member assignments, blockers, sprints).

---

## 3. Core AI Capabilities

### 3.1 Natural-Language Task Extraction
- **Endpoint**: `POST /api/ai/extract-task`
- **Payload**: `{ "prompt": string, "projectId": ObjectId }`
- **Output**: Structured JSON containing extracted `title`, `description`, `priority`, `dueDate`, `estimatedHours`, `labels`, and initial `checklist`.
- **UI Component**: `NaturalLanguageTaskModal` (`frontend/src/components/NaturalLanguageTaskModal.jsx`), triggered via the "AI Prompt" button on the Kanban board.
- **Approval Flow**: The extracted fields are shown in a live interactive preview. Clicking "Use Extracted Task" loads the attributes into the standard `TaskModal` for final adjustments and saving.

### 3.2 Task Decomposition & Acceptance Criteria Suggestions
- **Endpoint**: `POST /api/ai/suggest-breakdown`
- **Payload**: `{ "taskId"?: ObjectId, "projectId": ObjectId, "title": string, "description"?: string }`
- **Output**: Enhanced description with explicit Given-When-Then acceptance criteria, suggested subtask checklist items, and estimated hours.
- **UI Component**: Integrated directly into `TaskModal` via the "AI Auto-Suggest" button next to Description.

### 3.3 Project Progress Summaries & Velocity Insights
- **Endpoint**: `GET /api/ai/project-summary/:projectId`
- **Output**: Total, completed, in-progress, and overdue task distributions; velocity calculation (completion rate %); and key actionable milestones.
- **UI Component**: "Progress Summary" tab in `AIProjectInsightsDrawer` (`frontend/src/components/AIProjectInsightsDrawer.jsx`), accessible via "AI Advisor" on the Kanban toolbar.

### 3.4 Delivery Risk & Dependency Blocker Detection
- **Endpoint**: `GET /api/ai/project-risks/:projectId`
- **Output**: Categorized risk posture (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), overdue tasks, unassigned critical items, and dependency chains causing active blocks.
- **UI Component**: "Risks" tab in `AIProjectInsightsDrawer`.

### 3.5 Intelligent Prioritization & Scheduling Recommendations
- **Endpoint**: `GET /api/ai/prioritize/:projectId`
- **Output**: Ranked task list sorted by dependency criticality, due-date urgency, priority weight, and blocking status.
- **UI Component**: "Prioritization" tab in `AIProjectInsightsDrawer`.

### 3.6 Grounded Context-Aware Project Q&A
- **Endpoint**: `POST /api/ai/ask`
- **Payload**: `{ "projectId": ObjectId, "query": string }`
- **Output**: Factual natural-language answer synthesized strictly from tasks, sprints, members, and milestones in the current project.
- **UI Component**: "Ask Project AI" tab in `AIProjectInsightsDrawer`.

---

## 4. Security, Tenancy & Prompt Injection Defenses

### 4.1 Tenancy & RBAC
- Every endpoint in `backend/src/routes/aiRoutes.js` is protected by JWT authentication (`authRequired`).
- Every project query executes `checkProjectAccess(projectId, req.user._id)` before retrieving documents or invoking provider logic.
- Cross-project or unauthenticated attempts receive `403 Forbidden` or `401 Unauthorized`.

### 4.2 Input Sanitization & Jailbreak Resistance
- `sanitizePromptInput(input, maxLength)` sanitizes all prompt inputs:
  - Enforces length limits (default 2,000 characters).
  - Strips non-printable ASCII/control characters.
  - Strips markdown formatting exploitations (`<script>`, `<iframe>`, `javascript:`).
  - Neutralizes common system prompt override patterns (e.g., `ignore previous instructions`, `disregard all previous directions`, `system prompt:`, `override rules:`).

### 4.3 Data Privacy
- No user passwords, authentication tokens, salt hashes, or secret keys are ever ingested into AI context or sent to providers.
- When an external provider is enabled, only sanitized task titles, statuses, and public project metadata are transmitted.

---

## 5. Testing & Verification

The AI subsystem is validated by automated tests across all tiers:
1. **Backend Heuristics & API Tests**: `backend/tests/aiManagement.test.js` (10 suites testing prompt injection, task extraction, breakdowns, summaries, risks, prioritization, and Q&A).
2. **Frontend Utility & Formatting Tests**: `frontend/tests/ai01.test.js` (formatting, velocity calculation, risk badges, criteria merging).
3. **Playwright End-to-End Tests**: `e2e/ai-project-management.spec.js` (verifies complete user journey: login, team creation, project setup, Kanban board navigation, AI Advisor drawer inspection, and natural-language prompt extraction into `TaskModal`).
4. **Secret Scanning**: `scripts/scan_secrets.js` verifies zero hardcoded keys or leaked credentials.

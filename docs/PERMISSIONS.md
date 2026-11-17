# Klavo Authorization & Access Control Policy (RBAC / IDOR Protection)

This document specifies the authorization rules, access boundaries, and anti-IDOR checks implemented in Klavo (**SEC-03**).

---

## 1. Resource Hierarchy

```
Team
 └── Project
      ├── Task
      │    └── Comment
      │         └── Reaction
      ├── Message (Project Chat)
      ├── Activity Log
      └── File Upload
```

Access to any child resource strictly requires verified access to its parent hierarchy.

---

## 2. Permission Matrix

| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Team** | Create | `POST /api/teams` | Authenticated user (becomes Owner) |
| **Team** | List My Teams | `GET /api/teams/my-teams` | Owner or Member of team |
| **Team** | Add Member | `POST /api/teams/add-member` | Owner or existing Member |
| **Team** | Delete Team | `DELETE /api/teams/:teamId` | **Owner Only** |
| **Project** | Create | `POST /api/projects` | Member/Owner of specified `teamId` |
| **Project** | List Projects | `GET /api/projects` | Only projects within teams where user is Member/Owner |
| **Project** | Get Members | `GET /api/projects/:projectId/members` | Member/Owner of project's team |
| **Project** | Delete Project | `DELETE /api/projects/:projectId` | **Project Creator** or **Team Owner** |
| **Task** | Create Task | `POST /api/tasks` | Member/Owner of task's project team |
| **Task** | List Tasks | `GET /api/tasks/project/:projectId` | Member/Owner of project's team |
| **Task** | Update Task | `PUT /api/tasks/:taskId` | Member/Owner of task's project team |
| **Task** | Move Task | `PUT /api/tasks/:taskId/move` | Member/Owner of task's project team |
| **Task** | Delete Task | `DELETE /api/tasks/:taskId` | Member/Owner of task's project team |
| **Comment** | Add Comment | `POST /api/comments/:taskId` | Member/Owner of task's project team |
| **Comment** | Get Comments | `GET /api/comments/:taskId` | Member/Owner of task's project team |
| **Reaction** | Add Reaction | `POST /api/reactions/:commentId` | Member/Owner of task's project team |
| **Message** | Get Chat | `GET /api/messages/:projectId` | Member/Owner of project's team |
| **Message** | Post Chat | `POST /api/messages/:projectId` | Member/Owner of project's team |
| **Activity**| Get Logs | `GET /api/activity/:projectId` | Member/Owner of project's team |
| **File** | Upload File | `POST /api/files/upload` | Member/Owner of project's team (if projectId specified) |
| **File** | Get Files | `GET /api/files/:projectId` | Member/Owner of project's team |
| **Dashboard**| Get Stats | `GET /api/dashboard` | Aggregates only teams & projects where user belongs |

---

## 3. Socket.IO Room Authorization

Socket connections are authenticated via JWT token verification on handshake:
- **`joinUser` (`user_${userId}`)**: Clients can only join their own verified user room.
- **`joinTeam` (`team_${teamId}`)**: Verified against team membership before joining room.
- **`joinProject` (`project_${projectId}`)**: Verified against project and team membership before joining room.

Unauthenticated or unauthorized socket clients cannot eavesdrop on private project channels or team events.

---

## 4. Client Session & Stability Policies (STAB-01)

- **Session Deserialization**: `localStorage.getItem("klavo_user")` is guarded via `getSafeStoredUser()` in Redux. Any malformed JSON or corrupted storage key is discarded cleanly without causing runtime React render exceptions.
- **Topbar User Resolution**: Connected directly to the centralized Redux state (`useSelector(state => state.auth?.user)`), defaulting to `"Guest"` if unauthenticated or state is unavailable.
- **401 Response Handling**: `axiosClient` intercepts `401 Unauthorized` responses globally. When an authenticated request fails with 401 (e.g. token expired, signature revoked), local session tokens are purged and the application cleanly redirects to `/login`.
- **Protected Routing**: `ProtectedRoute` renders a spinner loading state while the authentication session is being determined and redirects unauthenticated users to `/login`.

---

## 5. Frontend Route Mapping (ROUT-01)

| Route Path | View Component | Protected | Sidebar Highlight | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `Dashboard.jsx` | Yes | Dashboard | Team & task summary metrics, activity velocity |
| `/projects` | `Projects.jsx` | Yes | Projects | Project listing, team project cards, creation modal |
| `/teams` | `Teams.jsx` | Yes | Teams | Team management, member invites, activity panel |
| `/kanban/:projectId` | `Kanban.jsx` | Yes | Projects | Interactive drag-and-drop task boards & real-time chat |
| `/calendar` | `Calendar.jsx` | Yes | Calendar | Personal upcoming task deadlines and schedule |
| `/files` | `Files.jsx` | Yes | Files | Project file uploads and asset repository |
| `/analytics` | `Analytics.jsx` | Yes | Analytics | Visual charts for task velocity & status distribution |
| `/login` | `Login.jsx` | No | N/A | Public user sign-in & Google OAuth |
| `/register` | `Register.jsx` | No | N/A | Public user registration |
| `*` | 404 Fallback | N/A | N/A | Graceful not found screen with return-home action |

---

## 6. End-to-End Module Integration (MOD-01)

### File Storage & Access Control:
- `POST /api/files/upload`: Multipart upload with size limit (25MB). Validates user access to target `projectId`. Persists file in `uploads/` with UUID-based key and stores metadata in MongoDB with `userId` ownership.
- `GET /api/files/project/:projectId`: Returns all files belonging to a project. Requires project team membership.
- `GET /api/files/download/:fileId`: Streams file binary with `Content-Disposition`. Verifies project team access before serving binary.
- `DELETE /api/files/:fileId`: Deletes file metadata and disk binary. Only file uploader, project creator, or team owner can execute.

### Calendar Deadlines:
- `GET /api/calendar`: Scoped strictly to projects belonging to teams where user is an owner/member. Returns assigned tasks with non-null due dates sorted chronologically.

### Analytics & Project Metrics:
- `GET /api/analytics/project/:projectId`: Computes project-level metrics (total tasks, completion percentage, status breakdown, and priority distribution) with verified project access.
- `GET /api/dashboard`: Aggregates cross-project activity across user's teams.

---

## 7. Real-Time Collaboration & Notification Specifications (MOD-02)

### Real-Time Socket Architecture:
- Handshake middleware validates JWT tokens and attaches authenticated user identity.
- Sub-socket handlers registered in `backend/src/index.js`:
  - `initNotificationSockets`: Listens for `joinUser` and `leaveUser`. Prevents authenticated users from subscribing to foreign user notification rooms.
  - `initCommentSockets`: Listens for `joinCommentThread` and `leaveCommentThread` (`comment_${commentId}`).
  - `initReactionSockets`: Listens for `joinReactions` and `leaveReactions` (`comment_${commentId}`).
  - Project/Team rooms: Listens for `joinProject`, `leaveProject`, `joinTeam`, `leaveTeam` with verified RBAC checks.

### Targeted Notifications & Event Dispatching:
- **Task Assignment (`TASK_ASSIGNED`)**: Dispatched to newly assigned team members. Self-assignment notifications are suppressed.
- **Comments (`COMMENT_ADDED`)**: Broadcast to `project_${projectId}` and `comment_${taskId}`. Dispatches targeted notifications to task assignees and task creator (suppressing self-notifications).
- **Mentions (`MENTION`)**: Parses `@username` tokens in comment bodies and dispatches targeted notifications to mentioned users.
- **Reactions (`REACTION_ADDED`, `REACTION_REMOVED`)**:
  - `POST /api/reactions/:commentId`: Validates task access, rejects duplicate identical reactions (409 Conflict), emits `reactionAdded` to thread and project rooms, and notifies comment author.
  - `DELETE /api/reactions/:commentId/:emoji`: Removes user reaction and emits `reactionRemoved`.
  - Database uniqueness index `{ commentId: 1, userId: 1, emoji: 1 }` prevents race duplicates.
- **Notification State Management**:
  - `GET /api/notifications`: Returns user's notifications sorted by newest first.
  - `PUT /api/notifications/:id`: Marks specific notification as read (with user ID authorization check).
  - `PUT /api/notifications/read-all`: Batch marks all unread notifications for the user as read.

---

## 8. Dashboard & Activity Feed Consistency (MOD-03)

### Dashboard Metrics Scoping (`GET /api/dashboard`):
- All metrics are strictly scoped to the requesting user's authorized teams (`members: userId` or `owner: userId`) and their child projects (`Project.find({ teamId: { $in: teamIds } })`).
- Foreign teams, projects, and tasks are strictly isolated and never included in counts or aggregates.
- **Weekly Task Activity**: Aggregates tasks by creation day, normalized to all 7 days of the week (`Sun` through `Sat`) with zero-filled gaps for predictable chart rendering.
- **Status Distribution**: Returns standard breakdown for `todo`, `in-progress`, and `done`.
- **Recent Activity**: Returns the 10 most recent activity logs across all accessible projects, populated with user and project details.

### Activity Logging & Feeds (`/api/activity`):
- `GET /api/activity/feed`: User-scoped team activity stream returning the 30 most recent actions across all authorized projects.
- `GET /api/activity/:projectId`: Scoped to a specific project with team membership verification (IDOR protection).
- Comprehensive activity logging:
  - Task Creation, Updating, Deletion, and Column Movement.
  - File Uploads.
  - Real-time `activityCreated` emission across project rooms.

---

## 9. Backend Reliability & Production Hardening (SEC-04)

### Central Error Handling & 404 Routing:
- `backend/src/middleware/errorHandler.js`:
  - Sanitizes all unhandled exceptions; in production (`NODE_ENV === "production"`), internal stack traces and server internals are suppressed.
  - Specialized formatters for Multer (`LIMIT_FILE_SIZE` -> 400), Mongoose CastErrors (`CastError` -> 400), Mongoose validation errors (`ValidationError` -> 400), and MongoDB unique index conflicts (`11000` -> 409).
  - Unmatched endpoints are handled by `notFoundHandler` returning structured 404 JSON.

### Sliding-Window Rate Limiting:
- `backend/src/middleware/rateLimiter.js`:
  - Lightweight in-memory sliding window algorithm without external Redis dependency.
  - Periodic background unref cleanup interval preventing memory leakage.
  - **Auth Limiter**: Applied to `/api/auth/register`, `/api/auth/login`, and `/api/auth/google` (max 20 attempts per 15 minutes per IP).
  - **Upload Limiter**: Applied to `/api/files/upload` (max 30 uploads per 10 minutes per IP).
  - Emits standard `Retry-After` HTTP headers on limit trips.

### Database Indexing Strategy:
- **Task**: Compound index on `{ projectId: 1, status: 1, order: 1 }`, `{ assignedTo: 1 }`, `{ dueDate: 1 }`, and `{ createdAt: -1 }`.
- **Team**: Indexed `{ owner: 1 }` and `{ members: 1 }`.
- **Project**: Indexed `{ teamId: 1 }` and `{ createdBy: 1 }`.
- **File**: Indexed `{ projectId: 1, createdAt: -1 }` and `{ userId: 1 }`.
- **Activity**: Indexed `{ projectId: 1, createdAt: -1 }` and `{ user: 1 }`.
- **Comment**: Indexed `{ taskId: 1, createdAt: 1 }` and `{ userId: 1 }`.
- **Reaction**: Compound unique index `{ commentId: 1, userId: 1, emoji: 1 }`.
- **Notification**: Indexed `{ userId: 1, read: 1, createdAt: -1 }`.
- **Message**: Indexed `{ projectId: 1, createdAt: 1 }`.

### Graceful Server Shutdown:
- Listens to `SIGTERM` and `SIGINT`.
- Closes HTTP server first to reject incoming connections while finishing in-flight requests.
- Closes MongoDB connection cleanly via `mongoose.connection.close()`.
- Implements a 10-second fail-safe timeout for forced exit if requests hang.

### File Storage Hardening & Architectural Analysis:
- **Upload Path Traversal Protection**: Upload directory is resolved to absolute path `path.resolve("uploads")` and verified on boot.
- **MIME & Extension Whitelist**: Multer file filter enforces whitelisted extensions (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.txt`, `.zip`).
- **Storage Strategy Assessment**:
  - *Current Design*: High-speed local disk storage (`uploads/`) with UUID keys and MongoDB metadata tracking.
  - *Limitation*: Ephemeral local disk storage is tied to a single compute container/instance and does not automatically share state across horizontally scaled multi-container clusters.
  - *Production Recommendation*: An S3-compatible object store (e.g., AWS S3, Cloudflare R2, Google Cloud Storage) or Cloudinary should be adopted when migrating from single-node deployments to multi-instance serverless/container clusters. The existing controller structure cleanly isolates storage key generation, streaming, and deletion, making an S3 client adapter a seamless drop-in replacement.

---

## 10. File Security, MIME Verification & Storage Readiness (SEC-05)

### MIME Spoofing & Whitelist Enforcement:
- `backend/src/routes/fileRoutes.js` enforces strict cross-validation between file extensions and incoming MIME types:
  - Whitelist: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.txt`, `.zip`.
  - Rejects disguised executables, scripts, HTML files, or mismatched MIME headers (e.g. `application/x-php` uploaded with a `.png` filename).
- Upload file size capped strictly at 25MB via Multer limits.

### SVG Injection & Active Script Sanitization:
- SVGs can contain active HTML/JavaScript that executes in the context of the user's session.
- `validateUploadedContent` inspects all `.svg` file buffers before saving.
- Rejects files containing `<script>` tags, inline event handlers (`onload`, `onerror`, `onclick`, `onmouseover`), `javascript:` URIs, or `<foreignObject>` tags, immediately removing the temporary file from disk.

### Path Traversal Hardening:
- `storageService.js` strips all path traversal sequences (`..`, `/`, `\`) and leading dots from storage keys.
- Resolves file paths against `baseDir` (`path.resolve("uploads")`) and verifies that `resolvedPath.startsWith(baseDir)`.

### Download Security Headers:
- `GET /api/files/download/:fileId`:
  - `X-Content-Type-Options: nosniff`: Prevents browser MIME sniffing.
  - `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`: Restricts active script or inline frame execution when viewing/downloading assets.
  - `Content-Disposition: attachment`: Forces direct download.

### Storage Service Provider Abstraction:
- `backend/src/services/storageService.js`:
  - Implements a uniform `StorageService` interface (`save`, `getFilePath`, `delete`, `exists`).
  - Defaults to `LocalDiskStorageProvider` without requiring external cloud accounts or paid services.
  - Architecture provides a plug-and-play adapter path to S3-compatible persistent object stores (AWS S3, Cloudflare R2, MinIO, Google Cloud Storage) without changes to controllers or frontend clients.

---

## 11. Advanced Task Management & Templates (PM-01)

### Priority Hierarchy & Visual Tokens:
- Priorities are strictly typed across 5 tiers:
  - `low`: Default background slate token with low urgency.
  - `medium`: Standard work item with balanced scheduling.
  - `high`: Elevates in sort order and calendar badges.
  - `critical`: High risk or blocker tag.
  - `urgent`: Pulsing purple badge, highest sorting weight.

### Task Blueprint / Templates Schema:
- Stored in `TaskTemplate` model (`backend/src/models/TaskTemplate.js`).
- Can be scoped at the **Project level** or **Team-wide level**.
- Holds blueprint configurations: `defaultTitle`, `defaultDescription`, `defaultPriority`, `defaultLabels`, `defaultCustomFields`, `checklist`, and `estimatedHours`.
- When instantiating tasks via `POST /api/tasks` with `templateId`, template blueprint defaults are automatically populated for any omitted fields while respecting explicit overrides.

### Permission Matrix for Task Templates:
| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **TaskTemplate** | Create | `POST /api/task-templates` | Member or Owner of team / project |
| **TaskTemplate** | List | `GET /api/task-templates?projectId=...` | Member or Owner of project's team |
| **TaskTemplate** | Get By ID | `GET /api/task-templates/:templateId` | Member or Owner of template's team |
| **TaskTemplate** | Update | `PUT /api/task-templates/:templateId` | Member or Owner of template's team |
| **TaskTemplate** | Delete | `DELETE /api/task-templates/:templateId` | Member or Owner of template's team |

### Anti-IDOR Protections for Task Attributes & Templates:
- `checkTeamAccess` and `checkProjectAccess` verify that the requesting user belongs to the associated team before permitting creation, inspection, editing, or deletion of templates.
- Task search and filter endpoints enforce strict project access boundaries before returning matching tasks or metadata.

---

## 12. Sprint Management (PM-02)

### Sprint Lifecycle & State Rules:
- Sprints follow an explicit lifecycle governed by `Sprint` model:
  - `planned`: Default status upon creation. Tasks can be planned and estimated.
  - `active`: In-flight iteration. Enforces business rule: **Only one active sprint is permitted per project** at any given time.
  - `completed`: Iteration concluded. Triggering `complete` automatically calculates rollover and moves uncompleted tasks (`status != 'done'`) to either product backlog (`sprintId: null`) or a specified target sprint.
  - `archived`: Read-only historic record.

### REST Endpoints for Sprints:
| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Sprint** | Create | `POST /api/sprints` | Member or Owner of project's team |
| **Sprint** | List | `GET /api/sprints/project/:projectId` | Member or Owner of project's team |
| **Sprint** | Get Details | `GET /api/sprints/:sprintId` | Member or Owner of sprint's project |
| **Sprint** | Update | `PUT /api/sprints/:sprintId` | Member or Owner of sprint's project |
| **Sprint** | Start Sprint | `POST /api/sprints/:sprintId/start` | Member or Owner of sprint's project |
| **Sprint** | Complete Sprint | `POST /api/sprints/:sprintId/complete` | Member or Owner of sprint's project |
| **Sprint** | Archive Sprint | `POST /api/sprints/:sprintId/archive` | Member or Owner of sprint's project |
| **Sprint** | Batch Task Assignment | `POST /api/sprints/:sprintId/tasks` | Member or Owner of sprint's project |
| **Sprint** | Delete Sprint | `DELETE /api/sprints/:sprintId` | Member or Owner of sprint's project (non-active only) |

### Anti-IDOR Protections for Sprints:
- `checkSprintAccess` resolves sprint -> project -> team hierarchy and denies any read/write request if the authenticated user does not belong to the project team.
- Batch task assignment enforces `{ _id: { $in: taskIds }, projectId: sprint.projectId }` to prevent cross-project task leakage or IDOR mutation.

---

## 13. Backlog Management & Prioritization (PM-03)

### Backlog Concept & Rank Reordering:
- Tasks with `sprintId === null` represent the **Product Backlog**.
- The backlog supports drag-and-drop rank ordering persisted via `order` integer index.
- `PUT /api/tasks/reorder`: Executes MongoDB `bulkWrite` operations updating task indices atomically.

### Sprint Capacity & Workload Estimation:
- Sprints include an optional `capacity` limit (in estimated hours).
- The system aggregates `estimatedHours` across assigned tasks.
- If committed hours exceed configured capacity, `isOverloaded: true` is computed dynamically, surfacing visual overload warnings and progress alerts.

### Bulk Operations & Anti-IDOR Protections:
- `POST /api/tasks/bulk`: Allows multi-task movement between backlog and sprints, status transitions, and priority shifts.
- Strictly bounds execution by `{ _id: { $in: taskIds }, projectId }` to prevent cross-tenant IDOR manipulation.

| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Task** | Bulk Update | `POST /api/tasks/bulk` | Member or Owner of project's team |
| **Task** | Reorder Backlog | `PUT /api/tasks/reorder` | Member or Owner of project's team |

---

## 14. Task Dependencies & Subtasks (PM-04)

### Dependency Graph Model & Relationships:
Tasks support 3 distinct dependency edge types:
- `blocks`: Current task blocks the target task (current task must finish before target can be completed).
- `blocked-by`: Current task is blocked by the target task (target task must finish before current task can be completed).
- `relates-to`: Non-blocking bi-directional associative relationship.

### Cycle Detection & Graph Integrity:
- **Depth-First Search (DFS) / BFS Cycle Traversal**: When adding or updating a dependency, the graph is traversed to verify that no circular dependencies (e.g., $A \to B \to A$ or $A \to B \to C \to A$) can be formed.
- **Self-Dependency Rejection**: Tasks cannot block or be blocked by themselves ($A \to A$ rejected with 400 Bad Request).
- **Cross-Project Boundary Isolation**: Target tasks must belong to the exact same `projectId` as the source task; cross-project dependency links are rejected with 400 Bad Request.

### Dependency-Aware Completion Validation (Blocker Gates):
- Updating a task status or moving a Kanban card to `"done"` checks whether the task has unresolved blocking dependencies (either direct `blocked-by` tasks not in `"done"` status or reverse `blocks` edges).
- If incomplete blockers exist, the mutation is rejected with 400 Bad Request (`isBlocked: true` and array of `blockingTasks`).
- Authorized users can pass `overrideBlockers: true` to bypass the blocker gate with explicit intent.

### Subtasks & Parent-Child Hierarchy:
- Tasks support a `parentId` reference.
- Top-level tasks on the Kanban board and Backlog have `parentId: null`.
- Subtasks inherit the project boundary and are queried with direct parent relations, exposing aggregated subtask completion counters (`completedSubtasks` / `totalSubtasks`).

### REST Endpoints for Dependencies:
| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Task Dependency** | Add Dependency | `POST /api/tasks/:taskId/dependencies` | Member or Owner of project team |
| **Task Dependency** | Remove Dependency | `DELETE /api/tasks/:taskId/dependencies/:dependencyTaskId` | Member or Owner of project team |
| **Task Subtasks** | Query Hierarchy | `GET /api/tasks/project/:projectId?parentId=:parentId` | Member or Owner of project team |

---

## 15. Project Milestones & Gantt Timeline (PM-05)

### Milestone Schema & Lifecycle:
Milestones represent high-level project deliverables, roadmap phases, or delivery deadlines:
- `name`: Required string identifier.
- `description`: Detailed deliverable goals and criteria.
- `status`: `planned` | `in_progress` | `completed` | `archived`.
- `startDate` / `dueDate`: Timeline range constraint (`startDate <= dueDate`).
- `ownerId`: Assigned milestone lead user.
- `completedAt`: Automatically marked when transitioning to `completed`.

### Interactive Gantt / Timeline Engine:
- **Timeline Range Bounds**: Dynamically computed across project milestones and scheduled tasks, calculating horizontal percentage offsets and proportional bar widths.
- **Progress Tracking**: Aggregated completion ratio (`completedTasks / totalTasks * 100`) displayed as internal progress fill bars.
- **Overdue Detection**: Dynamically flags overdue states when `dueDate < now` and status is not `completed` or `archived`.
- **Dependency Visualization**: Exposes blocking task dependency edges on Gantt timeline items.

### Authorization & Security Policies:
- Project-level authorization: All milestone queries, mutations, and Gantt aggregations enforce that the authenticated user belongs to the project team (`checkProjectAccess` / `checkMilestoneAccess`).
- Batch task assignment enforces `{ _id: { $in: taskIds }, projectId: milestone.projectId }` to prevent cross-project IDOR tampering.

### REST Endpoints for Milestones & Gantt:
| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Milestone** | Create | `POST /api/milestones` | Member or Owner of project team |
| **Milestone** | List for Project | `GET /api/milestones/project/:projectId` | Member or Owner of project team |
| **Milestone** | Get Gantt Timeline | `GET /api/milestones/project/:projectId/gantt` | Member or Owner of project team |
| **Milestone** | Get Details | `GET /api/milestones/:milestoneId` | Member or Owner of project team |
| **Milestone** | Update | `PUT /api/milestones/:milestoneId` | Member or Owner of project team |
| **Milestone** | Batch Task Assignment | `POST /api/milestones/:milestoneId/tasks` | Member or Owner of project team |
| **Milestone** | Delete | `DELETE /api/milestones/:milestoneId` | Member or Owner of project team |

---

## 16. Custom Workflows & Status Management (PM-06)

### Workflow Schema & Status Items:
Project workflows configure dynamic task stages, status ordering, and categorization:
- `name`: Workflow display name.
- `projectId`: One-to-one unique project association.
- `statuses`: Ordered list of status definitions:
  - `key`: Lowercase alphanumeric unique slug (e.g., `"todo"`, `"in-progress"`, `"staging-qa"`, `"shipped"`).
  - `name`: User-facing title.
  - `color`: Hex color accent for Kanban column headers and badges.
  - `category`: Semantic lifecycle category (`"todo"`, `"in_progress"`, `"review"`, `"done"`).
  - `order`: Display order index.

### Category-Aware Invariants & Validation:
- **Mandatory Categories**: Workflows must contain at least 2 statuses, including at least one status in `"todo"` category and at least one status in `"done"` category.
- **Completion Semantics**: Blocker gates, subtask completion metrics, sprint rollover, and milestone completion dynamically evaluate whether a task status belongs to category `"done"` (`isStatusCompleted`).
- **In-Use Status Deletion Safety**: Modifying a workflow rejects removing any status if active tasks in the project are currently assigned to that status, preventing orphan states.

### REST Endpoints for Workflows:
| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Workflow** | Get Project Workflow | `GET /api/workflows/project/:projectId` | Member or Owner of project team |
| **Workflow** | Update Workflow | `PUT /api/workflows/project/:projectId` | Member or Owner of project team |
| **Workflow** | Reset to Standard | `POST /api/workflows/project/:projectId/reset` | Member or Owner of project team |

---

## 17. Advanced Search, Filtering & Saved Views (PM-07)

### Advanced Search & Multi-Attribute Filtering Engine:
- **Comprehensive Text Search**: Performs case-insensitive regular expression search across task `title`, `description`, and `labels.name`.
- **Multi-Status & Multi-Priority Arrays**: Supports array or comma-separated query parameters (`statuses`, `priorities`) for multi-select filtering.
- **Assignee Targeting**: Supports user ObjectIds, special token `"me"` (resolved to authenticated requester), and `"unassigned"` (matching empty or nonexistent assignee arrays).
- **Date Range Filters**: Evaluates relative intervals including `overdue`, `today`, `this_week`, `next_week`, and `no_due_date`.
- **Dependency Relationships**: Filters tasks based on dependency criteria (`blocked_only`, `unblocked_only`, `has_dependencies`, `no_dependencies`).
- **Custom Field Filtering**: Queries nested custom fields by field name, existence, equality, and substring matching.

### Saved Views Schema & Multi-Tenant Access Model:
- `name`: View display title.
- `description`: Optional context for team members.
- `projectId` / `teamId`: Strictly bounded project and team references.
- `createdBy`: User ID of creator.
- `isShared`: 
  - `false` (Personal): Visible only to `createdBy`.
  - `true` (Shared): Visible to all members of the project team.
- `viewType`: `"kanban"` | `"backlog"` | `"all"`.
- `filters`: Stored query criteria matching filter configuration.
- `sortBy` / `sortOrder`: Preferred ordering (`order`, `priority`, `dueDate`, `createdAt`, `updatedAt`, `title`, `estimatedHours`).
- `groupBy`: Dynamic section grouping (`none`, `status`, `priority`, `assignee`, `milestone`).
- `isDefault`: Marks preferred view upon project initialization (scoped by user for personal views, or project-wide for shared views).

### Authorization & IDOR Security Policies:
- Project-level authorization: View creation and retrieval require team membership in the parent project (`checkProjectAccess`).
- View mutation & deletion: Strictly restricted to the **view creator** (`createdBy === req.user._id`) or the **Team Owner**. Other team members cannot mutate or delete another user's saved views.

### REST Endpoints for Saved Views:
| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Saved View** | Create View | `POST /api/saved-views` | Member or Owner of project team |
| **Saved View** | List Project Views | `GET /api/saved-views/project/:projectId` | Member or Owner of project team |
| **Saved View** | Get View Details | `GET /api/saved-views/:viewId` | Member (if shared) or Creator / Team Owner |
| **Saved View** | Update View | `PUT /api/saved-views/:viewId` | Creator of view or Team Owner |
| **Saved View** | Delete View | `DELETE /api/saved-views/:viewId` | Creator of view or Team Owner |

---

## 18. Workflow Automation & Recurring Tasks (PM-08)

### Automation Rule Engine & Event Lifecycle:
- **Event Triggers**:
  - `task_created`: Evaluates when any task is created in the project.
  - `status_changed`: Evaluates when a task status transitions (supports `fromValue` and `toValue` constraints).
  - `priority_changed`: Evaluates on priority mutations.
  - `assignee_changed`: Evaluates on assignment updates.
  - `due_date_changed`: Evaluates on due date adjustments.
- **Conditions Engine**:
  - Multi-operator matching (`equals`, `not_equals`, `in`, `not_in`, `is_empty`, `is_not_empty`, `contains`).
  - Supports field checks across `status`, `priority`, `assignedTo`, `labels`, `milestoneId`, `sprintId`, and `dueDate`.
- **Action Execution**:
  - State transitions (`set_status`, `set_priority`, `assign_user`, `add_assignee`, `remove_assignee`, `add_label`, `set_due_date_relative`).
  - Real-time notifications dispatched to target members (`send_notification`).
- **Loop Protection & Safeguards**:
  - Enforces a maximum recursion cascade depth (`MAX_EXECUTION_DEPTH = 3`).
  - Tracks rule execution chains (`seenRules` set) to prevent circular cascades.
  - Full execution audit logging (`AutomationLog`) for auditability and failure analysis.

### Recurring Task Schedules:
- Configurable recurrence frequencies (`daily`, `weekly`, `monthly`) with step intervals (`interval >= 1`).
- Weekday masks for weekly recurrences (`daysOfWeek: [0..6]`) and calendar days for monthly schedules (`dayOfMonth: [1..31]`).
- Timezone-aware date calculations and expiration constraints (`endDate`).
- Manual trigger capabilities for testing and instant generation.

### Authorization & Access Control:
- Project team members can create, inspect, pause, resume, and delete automation rules and recurring task schedules (`checkProjectAccess`).
- Real-time Socket.IO broadcasts ensure all collaborators receive live updates on rule and schedule mutations (`automationRuleCreated`, `recurringTaskCreated`, `automationExecuted`).

### REST Endpoints for Automations & Recurring Tasks:
| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Automation Rule** | Create Rule | `POST /api/automations/rules` | Member or Owner of project team |
| **Automation Rule** | List Project Rules | `GET /api/automations/rules/project/:projectId` | Member or Owner of project team |
| **Automation Rule** | Update Rule | `PUT /api/automations/rules/:ruleId` | Member or Owner of project team |
| **Automation Rule** | Delete Rule | `DELETE /api/automations/rules/:ruleId` | Member or Owner of project team |
| **Automation Log** | Get Logs | `GET /api/automations/logs/project/:projectId` | Member or Owner of project team |
| **Recurring Task** | Create Schedule | `POST /api/automations/recurring` | Member or Owner of project team |
| **Recurring Task** | List Project Schedules | `GET /api/automations/recurring/project/:projectId` | Member or Owner of project team |
| **Recurring Task** | Update Schedule | `PUT /api/automations/recurring/:recurringId` | Member or Owner of project team |
| **Recurring Task** | Delete Schedule | `DELETE /api/automations/recurring/:recurringId` | Member or Owner of project team |
| **Recurring Task** | Trigger Execution Now | `POST /api/automations/recurring/:recurringId/trigger` | Member or Owner of project team |

---

## 19. Rich Text Editor & Document Foundation (DOC-01)

### Document Data Model:
- `title`: String identifier (default: `"Untitled Document"`).
- `content`: ProseMirror / TipTap structured JSON object tree.
- `contentHtml`: Sanitized HTML snapshot for safe rendering, exports, and previews.
- `description`: Plain text excerpt extracted from document body for search indexing.
- `projectId` / `teamId`: Multi-tenant ownership and tenancy scoping.
- `createdBy` / `lastUpdatedBy`: User audit references.
- `isArchived`: Boolean flag for non-destructive lifecycle management.

### HTML & JSON Sanitization Engine (`documentSanitizer.js`):
- Strips active executable tags (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<base>`, `<link>`, `<meta>`).
- Strips all inline event handlers (`onload`, `onerror`, `onclick`, `onmouseover`, etc.).
- Neutralizes dangerous pseudo-protocols (`javascript:`, `data:`, `vbscript:`) in hyperlinks (`href="#"`).
- Preserves all valid TipTap rich text markup: headings (H1–H3), paragraphs, lists (bullet, numbered), blockquotes, code blocks, bold, italic, underline, and secure external/internal URLs.

### Client-Side Autosave & Real-Time Sync:
- Debounced autosave mechanism (1200ms) with visible save status indicators (`saved`, `saving`, `unsaved`, `error`).
- Real-time Socket.IO broadcasts for document creation, content updates, and deletion (`documentCreated`, `documentUpdated`, `documentDeleted`).

### Authorization Matrix for Documents:
| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Document** | Create Document | `POST /api/documents` | Member or Owner of project team |
| **Document** | List Documents | `GET /api/documents/project/:projectId` | Member or Owner of project team |
| **Document** | Get Document | `GET /api/documents/:documentId` | Member or Owner of project team |
| **Document** | Update Document | `PUT /api/documents/:documentId` | Member or Owner of project team |
| **Document** | Delete Document | `DELETE /api/documents/:documentId` | Document Creator or Team Owner |

---

## 20. Document Organization & Project Folders (DOC-02)

### DocumentFolder Schema & Hierarchy:
- `name`: String identifier for folder.
- `description`: Optional contextual summary.
- `color`: Hex color accent for visual differentiation.
- `icon`: Folder icon identifier (default: `"folder"`).
- `parentId`: Self-referencing folder ObjectId (`null` = root folder in project).
- `projectId` / `teamId`: Strictly bounded project and team references.
- `createdBy`: User ID of creator.
- `order`: Integer sequence ordering.
- `isArchived`: Boolean flag for non-destructive lifecycle management.

### Hierarchy & Circular Reference Prevention (`folderHelpers.js`):
- `checkCircularFolderNesting`: Traverses ancestry tree upward from target parent to root. Rejects moving a folder under itself or any of its descendants.
- `getDescendantFolderIds`: Aggregates all child folders recursively.
- `getFolderBreadcrumbs`: Resolves full ordered path array from root to current folder for navigation.

### Safe Reparenting on Folder Deletion:
- When a folder is deleted, child folders and contained documents are safely reparented to the deleted folder's `parentId` (or `null` / root) to prevent accidental orphaning.

### Authorization Matrix for Document Folders:
| Resource | Action | Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Document Folder** | Create Folder | `POST /api/documents/folders` | Member or Owner of project team |
| **Document Folder** | List Folders | `GET /api/documents/folders/project/:projectId` | Member or Owner of project team |
| **Document Folder** | Get Folder | `GET /api/documents/folders/:folderId` | Member or Owner of project team |
| **Document Folder** | Update / Move | `PUT /api/documents/folders/:folderId` | Member or Owner of project team |
| **Document Folder** | Delete Folder | `DELETE /api/documents/folders/:folderId` | Folder Creator or Team Owner |
| **Document Move** | Move Document | `PUT /api/documents/:documentId` (`folderId`) | Member or Owner of project team |

---

## 21. Real-Time Collaborative Document Editing & Cursors (DOC-03)

### Real-Time Synchronization Architecture:
- **Yjs CRDT Foundation**: Concurrent edits across multiple active collaborators merge deterministically without conflict or overwrite.
- **WebSocket Transport**: Leverages existing authenticated Socket.IO connection via `CollabSocketProvider` to synchronize binary state updates (`docSyncInit`, `docSyncUpdate`).
- **Binary Persistence**: Binary CRDT document state (`yjsUpdate`) is persisted in MongoDB, allowing collaborative documents to survive page reloads and server restarts.
- **Debounced Flush**: In-memory document rooms debounce persistence flushes to avoid database thrashing during rapid keystrokes, with immediate flush on room tear-down.

### Collaborator Presence & Cursor Awareness:
- **Presence Indicators**: Live collaborator avatars/initials and active count rendered in top navigation bar.
- **Collaborator Cursors**: Live remote cursors, selection highlights, and user name tags mapped through TipTap's `CollaborationCursor` extension and Yjs `Awareness`.
- **Deterministic Color Assignment**: Collaborator colors are assigned deterministically from user ID hashing across a curated high-contrast palette.

### Lifecycle & Anti-Stale Safeguards:
- **Room Membership Cleanup**: When a user leaves or a socket disconnects, the collaborator is removed from memory, remaining participants receive `collabUserLeft`, and empty rooms flush state and clean up resources.
- **Anti-IDOR Protection**: Sockets must be authorized project team members to join collaborative document rooms (`joinDocumentCollab`); unauthorized connection attempts are rejected with `collabError`.
- **Identity Integrity**: Collaborator identity payload is extracted securely from `socket.user` rather than trusting client-provided spoofable strings.

### Authorization Matrix for Document Collaboration:
| Resource | Action | Socket Event / Endpoint | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Document Collaboration Room** | Join Collab Room | `joinDocumentCollab` (`documentId`) | Member or Owner of project team |
| **Document Collaboration Sync** | Send/Receive Updates | `docSyncUpdate` (`documentId`) | Active Member in collaborative room |
| **Document Cursor Presence** | Transmit Cursor/Selection | `collabCursorMove` (`documentId`) | Active Member in collaborative room |
| **Document Collaboration Room** | Leave Collab Room | `leaveDocumentCollab` (`documentId`) | Any joined user |

---

## 22. Granular Document Permissions & Secure Sharing (DOC-04)

### Document Role Hierarchy:
- **Owner (Level 4)**: Full control. Read, comment, edit, manage permissions/shares, transfer ownership, move cross-project, and delete document.
- **Editor (Level 3)**: Content authoring. Read, comment, edit TipTap content, and participate in real-time collaborative editing (`docSyncUpdate`).
- **Commenter (Level 2)**: Read document content and view collaboration cursors without modification rights.
- **Viewer (Level 1)**: Read-only access. Cannot edit or broadcast collaboration sync updates.

### Permission Inheritance & Explicit Overrides:
- **Creator / Team Owner Guarantee**: The document creator and project team owner always hold the **Owner** role.
- **Project-Level Default Access (`defaultAccess`)**: Unspecified team members inherit `doc.defaultAccess` (configurable to `editor`, `commenter`, or `viewer`).
- **Direct Share Grants (`shares`)**: Explicit grants to individual team members override project-level defaults.
- **Cross-Tenant Boundary**: Shares are strictly restricted to authenticated members of the project's parent team. Non-team members cannot be granted access.

### Real-Time Socket.IO Synchronization Enforcement:
- `joinDocumentCollab`: Verifies user has at least `canRead` permission before admitting the socket into `doc_collab_${documentId}`.
- `docSyncUpdate`: Verified server-side. Collaborators with `canEdit === false` (Viewers/Commenters) are rejected with `collabError` if they attempt to broadcast CRDT changes.
- **Revocation / Downgrade Broadcasts**: When permissions are updated or revoked, the server broadcasts `collabPermissionUpdated` or `collabPermissionRevoked` to immediately downgrade or evict participants.

### Authorization Matrix for Document Sharing & Permissions:
| Resource | Action | Endpoint / Socket | Required Role / Permission |
| :--- | :--- | :--- | :--- |
| **Document Share** | Grant / Update Share | `POST /api/documents/:documentId/share` | Document Owner or Team Owner |
| **Document Share** | Revoke Share | `DELETE /api/documents/:documentId/share/:targetUserId` | Document Owner or Team Owner |
| **Document Ownership** | Transfer Ownership | `POST /api/documents/:documentId/transfer-ownership` | Document Owner or Team Owner |
| **Document Read** | View Document | `GET /api/documents/:documentId` | Viewer, Commenter, Editor, or Owner |
| **Document Edit** | Update Content | `PUT /api/documents/:documentId` | Editor or Owner |
| **Document Move** | Move between Projects | `PUT /api/documents/:documentId` (`targetProjectId`) | Document Owner or Team Owner |
| **Document Delete** | Delete Document | `DELETE /api/documents/:documentId` | Document Owner or Team Owner |
| **Real-Time Collab Sync** | Broadcast CRDT Updates | `docSyncUpdate` | Editor or Owner (`canEdit === true`) |

---

## 23. Document Comments, Mentions & Inline Discussions (DOC-05)

### Comment Hierarchy & Model Architecture (`DocumentComment`):
- `documentId` / `projectId`: Strictly scoped tenancy references.
- `parentCommentId`: `null` for root discussion threads; references parent comment ID for threaded replies.
- `userId`: Author of the comment.
- `text`: Plain/markdown comment content.
- `anchor`: Metadata anchoring discussion to selected text excerpt (`selectedText`, `from`, `to`).
- `isResolved` / `resolvedBy` / `resolvedAt`: Lifecycle tracking for resolved threads.
- `mentions`: Array of referenced User ObjectIds extracted via `@username` pattern.

### Mention Resolution & Privacy Bounds:
- `resolveEligibleMentions`: Parses `@username` from text and restricts mention eligibility strictly to active members of the project's parent team. Mentions of non-team members are ignored to prevent cross-tenant data leakage.
- Persistent targeted notifications are delivered to mentioned members and parent thread authors.

### Role Authorization Matrix for Document Comments:
| Role | View Comments | Create / Reply | Resolve / Reopen | Edit / Delete Own | Edit Document Content |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Owner** | Yes | Yes | Yes | Yes (and can delete any) | Yes |
| **Editor** | Yes | Yes | Yes | Yes | Yes |
| **Commenter** | Yes | Yes | Yes | Yes | **No (Read-Only Editor)** |
| **Viewer** | Yes | **No** | **No** | **No** | **No** |

### Real-Time Socket.IO Synchronization:
- `docCommentAdded`: Emitted to `doc_collab_${documentId}` when a thread or reply is posted.
- `docCommentResolved`: Broadcast when a thread is marked resolved or reopened.
- `docCommentDeleted`: Broadcast when a comment or thread is deleted (deleting root threads cascades to all replies).
- `docCommentUpdated`: Broadcast when an author edits their comment text.

---

## 24. Document Version History & Recovery (DOC-06)

### Data Model Architecture (`DocumentVersion`):
- `documentId`: Strictly references parent `Document`.
- `projectId`: Enforces project-level scoping and tenancy boundaries.
- `revisionNumber`: Sequential positive integer assigned monotonically per document.
- `title`: Sanitized document title snapshot.
- `content`: Sanitized ProseMirror/TipTap JSON syntax tree representing structured node hierarchy.
- `contentHtml`: Sanitized HTML snapshot for preview rendering and visual diff computations.
- `description`: Excerpt or document subtitle snapshot.
- `yjsUpdate`: Authoritative Base64-encoded binary CRDT state vector corresponding to this revision.
- `authorId`: User who authored the change, took the named snapshot, or performed the restoration.
- `isNamedSnapshot`: Boolean distinguishing manual named checkpoints from background autosaves.
- `snapshotName`: Optional user-specified descriptive title for the checkpoint (e.g., `"v1.0 Baseline"`).
- `changeSummary`: Human-readable description of change or restoration event.
- `contentHash`: SHA-256 hash of normalized `{ title, content, contentHtml }` used for duplicate snapshot prevention.
- **Compound Indexes**:
  - `{ documentId: 1, revisionNumber: -1 }` (Unique): Guarantees sequential revision uniqueness and fast chronological retrieval.
  - `{ documentId: 1, createdAt: -1 }`: Accelerated historical timeline queries.

### Content Hashing & Duplicate Snapshot Prevention:
- Keystrokes, autosaves, or minor edits that do not alter the content hash (`contentHash`) are automatically deduplicated and skipped during background auto-snapshotting.
- Manual named snapshots and restoration operations bypass deduplication (`force: true`) to ensure explicit user checkpoints are always recorded.
- Atomic retry loops prevent revision number allocation race conditions during concurrent snapshot requests.

### Non-Destructive Append-Only Restoration Architecture:
Restoring a previous document revision **never erases, rewinds, or truncates** revision history:
1. When a document is restored to Revision `#X`, the document attributes (`title`, `content`, `contentHtml`, `yjsUpdate`) are updated to reflect Revision `#X`.
2. A **new** revision record `#N+1` is appended to the `DocumentVersion` collection with `changeSummary: "Restored to Revision #X (\"...\")"`.
3. Document metadata, `folderId`, `projectId` tenancy, `shares` access grants, permissions, and comment threads are preserved intact.

### Yjs Real-Time State Replacement & Concurrency Invariants:
`Y.applyUpdate()` commutative merging merges concurrent or newer edits rather than rolling them back. To guarantee consistency during version restoration:
1. The backend cancels any pending debounced disk persist timers on the active room.
2. The active in-memory room (`activeDocRooms.get(documentId)`) replaces its `doc` instance with a fresh `Y.Doc` initialized cleanly from the restored snapshot bytes.
3. The authoritative state vector is encoded and broadcast to all connected clients in `doc_collab_${documentId}` via `docResetState`.
4. Connected clients (TipTap / `CollabSocketProvider`) receive the authoritative reset and update their local document state without disconnecting.

### Role Authorization Matrix for Version History & Recovery:
| Role | View Revisions | View Previews / Diffs | Create Named Snapshot | Restore Previous Revision |
| :--- | :---: | :---: | :---: | :---: |
| **Owner** | Yes | Yes | Yes | Yes |
| **Editor** | Yes | Yes | Yes | Yes |
| **Commenter** | Yes | Yes | **No (403 Forbidden)** | **No (403 Forbidden)** |
| **Viewer** | Yes | Yes | **No (403 Forbidden)** | **No (403 Forbidden)** |
| **Outsider** | **No (403/404)** | **No (403/404)** | **No (403/404)** | **No (403/404)** |

### API Endpoints:
- `POST /api/documents/:documentId/versions` — Creates a manual named snapshot checkpoint (`canEdit` required).
- `GET /api/documents/:documentId/versions` — Lists chronological revision history with pagination (`canRead` required).
- `GET /api/documents/:documentId/versions/:versionId` — Retrieves full details of a specific revision (`canRead` required).
- `GET /api/documents/:documentId/versions/compare` — Computes sanitized visual word-level diff between versions or against current document (`canRead` required).
- `POST /api/documents/:documentId/versions/:versionId/restore` — Restores document content non-destructively and synchronizes collaboration state (`canEdit` required).

---

## 25. Project Wiki & Knowledge Base (DOC-07)

### Data Architecture & Tenancy:
The Wiki Knowledge Base builds directly on Klavo's unified document storage model while introducing project-scoped hierarchy and landing features:
- **`isWiki` (Boolean)**: Identifies knowledge base articles and partitions them cleanly from arbitrary unfiled files/documents.
- **`isWikiHome` (Boolean)**: Designates the primary Project Wiki Landing Page. At most one document per project is marked as `isWikiHome: true`. If none exists or a project wiki is first accessed, a default landing page is automatically created or designated.
- **`parentWikiId` (ObjectId referencing `Document`)**: Establishes infinite hierarchical page nesting. Must strictly belong to the same `projectId`.
- **`wikiOrder` (Number)**: Monotonic sibling ordering within a parent topic.
- **`wikiSlug` (String)**: URL-friendly identifier derived from page title.
- **Compound Indexes**:
  - `{ projectId: 1, isWiki: 1, isArchived: 1 }`: Fast retrieval of project-scoped knowledge bases.
  - `{ projectId: 1, parentWikiId: 1, wikiOrder: 1 }`: Accelerated hierarchical tree queries.
  - `{ projectId: 1, isWikiHome: 1 }`: Instant home page resolution.

### Anti-Circular Nesting & Safe Reparenting:
- **Cycle Prevention (`checkCircularWikiNesting`)**: Moving or reparenting a wiki page checks transitive ancestors. Any operation where a page attempts to become a child of itself or one of its descendants is rejected with `400 Bad Request`.
- **Safe Cascade Reparenting on Deletion**: When a parent wiki page is deleted, its immediate child pages are non-destructively reparented to the deleted page's `parentWikiId` (or `null`/root) to eliminate orphaned nodes.
- **Project Isolation**: Setting `parentWikiId` or moving pages across different projects is rejected, ensuring strict tenant isolation.

### Permissions & Security Matrix:
All wiki pages inherit granular document access rules (`resolveDocumentAccess`):
| Action | Required Permission / Role |
| :--- | :--- |
| **View Wiki Tree & Pages** | Project Member with `canRead` (Viewer, Commenter, Editor, Owner) |
| **Search Knowledge Base** | Project Member with `canRead` |
| **Create New Wiki Page** | Project Member (`canEdit`) |
| **Edit Wiki Content / Auto-save** | `canEdit` (Editor or Owner) |
| **Reparent / Reorder Pages** | `canEdit` (Editor or Owner) |
| **Designate Wiki Home** | `canManagePermissions` (Owner) |
| **Manage Direct Shares** | `canManagePermissions` (Owner) |
| **Delete Wiki Page** | `canDelete` (Owner or Team Owner) |
| **Restore Previous Revision** | `canEdit` (Editor or Owner) |

### Real-Time Synchronization & Events:
- `wikiPageCreated`: Broadcast to `project_${projectId}` when a page is added.
- `wikiPageUpdated`: Broadcast to `project_${projectId}` when content, title, or parent topic changes.
- `wikiPageDeleted`: Broadcast to `project_${projectId}` and active collaboration room.
- `wikiTreeReordered`: Broadcast when sibling ordering is updated in bulk.
- Seamless real-time collaborative editing via Yjs (`doc_collab_${documentId}`) and discussions/comments (DOC-05).

### API Endpoints:
- `POST /api/documents/wiki` — Creates a new wiki page (`canEdit` required).
- `GET /api/documents/wiki/project/:projectId` — Retrieves all wiki pages and nested tree hierarchy for a project (`canRead` required).
- `GET /api/documents/wiki/project/:projectId/home` — Retrieves or lazily creates the project wiki landing page (`canRead` required).
- `POST /api/documents/wiki/project/:projectId/reorder` — Reorders sibling wiki pages in bulk (`canEdit` required).
- `GET /api/documents/wiki/:documentId` — Retrieves a specific wiki page with resolved breadcrumbs and child topics (`canRead` required).
- `PUT /api/documents/wiki/:documentId` — Updates wiki content, title, home status, or parent hierarchy (`canEdit` required).
- `DELETE /api/documents/wiki/:documentId` — Deletes wiki page and reparents child pages (`canDelete` required).

---

## 26. Document & Task Linking (DOC-08)

### Data Architecture & Storage:
Establishes bi-directional association between Documents (including Wiki knowledge base articles) and Tasks without data duplication:
- **`Task.linkedDocuments` (Array of ObjectId referencing `Document`)**: Holds references to documents connected to the task.
- **`Document.linkedTasks` (Array of ObjectId referencing `Task`)**: Holds reverse references to tasks connected to the document.
- **Compound Indexes**:
  - `{ linkedDocuments: 1 }` on `Task`: Fast retrieval of tasks referencing documents.
  - `{ linkedTasks: 1 }` on `Document`: Instant query resolution for reverse document-to-task navigation.

### Project Boundary & Tenancy Isolation:
- **Same-Project Invariant**: Both the target `Task` and `Document` must belong to the exact same `projectId`. Any cross-project linking attempt is rejected with `400 Bad Request` to strictly enforce tenant isolation.
- **Anti-IDOR & Permission Enforcement**:
  - Linking or unlinking requires authorized project/task write access.
  - Viewing linked documents on a task requires task access and filters out documents where the user does not possess `canRead` permission.
  - Reverse navigation (`GET /api/documents/:documentId/tasks`) enforces document-level `canRead` authorization before serving linked tasks.

### Real-Time Synchronization & Events:
- `taskUpdated`: Broadcast to `project_${projectId}` when task document associations change.
- `documentUpdated`: Broadcast to `project_${projectId}` when document task links change.
- `documentTaskLinked`: Broadcast to active collaborative rooms (`doc_collab_${documentId}`) when a link is created.

### API Endpoints:
- `POST /api/tasks/:taskId/documents/:documentId` — Links a document/wiki page to a task (requires task access & document `canRead`).
- `DELETE /api/tasks/:taskId/documents/:documentId` — Unlinks a document from a task (requires task access).
- `GET /api/tasks/:taskId/documents` — Lists all documents linked to a task with permission resolution (requires task access).
- `GET /api/documents/:documentId/tasks` — Lists all tasks linked to a document for reverse navigation (requires document `canRead`).
- `GET /api/documents/project/:projectId/linked-documents` — Overview of project documents that possess linked tasks (requires project access).

---

## 27. Advanced Project Analytics Dashboard (ANL-01)

### Overview & Data Architecture:
Provides real-time, comprehensive project-level analytics, key performance indicators (KPIs), workload distribution, workflow status distribution, and velocity tracking without duplicate data storage, fabricated metrics, or N+1 queries.

### Metrics & Aggregation Engine:
- **Project Overview**: Total tasks, completed tasks, in-progress tasks, overdue tasks, unassigned tasks, and completion percentage.
- **Workflow-Aware Completion Semantics**: Dynamically resolves task completion against custom project workflows via `isStatusCompleted` and `getCompletedStatusKeys` (category `"done"`).
- **Status & Priority Distributions**: Aggregates tasks across workflow status keys with custom colors and names, as well as the 5 priority levels (`low`, `medium`, `high`, `critical`, `urgent`).
- **Team Workload Overview**: Aggregates tasks, completed items, active pending work, and overdue tasks per team member. Pre-seeded with project team members to surface 0-task members cleanly.
- **Velocity & Activity**: Task creation distribution across days of the week, alongside the 10 most recent chronological project activities.
- **Date-Range Filtering**: Supports filtering task metrics by date bounds (`all`, `today`, `this_week`, `this_month`, `last_30_days`, or custom `startDate` and `endDate`).
- **Empty State Invariants**: Safely handles empty projects without division by zero or UI crashes.

### Permissions & Anti-IDOR Enforcement:
- Access to project analytics (`GET /api/analytics/project/:projectId`) strictly requires verified project team membership via `checkProjectAccess`.
- Unauthenticated requests are rejected with `401 Unauthorized`.
- Unauthorized users or cross-tenant outsiders are rejected with `403 Forbidden`.

### API Endpoints:
| Endpoint | Method | Required Permission / Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/analytics/project/:projectId` | `GET` | Project Team Member / Owner | Retrieves comprehensive project metrics, workload, status & priority distributions, and KPIs |

---

## 28. Sprint Velocity & Burndown Analytics (ANL-02)

### Overview & Data Architecture:
Provides real-time sprint iteration analytics including historical velocity trends, committed vs completed work, scope changes, carryover task analysis, and sprint burndown tracking without fabricating historical daily snapshots.

### Metrics & Aggregation Engine:
- **Measurement Units**: Supports velocity tracking using either `estimatedHours` or `storyPoints` (with 1 unit fallback if unestimated), clearly displayed in the UI.
- **Sprint Burndown Timeline**:
  - Computes linear ideal burn rate guideline across sprint date boundaries (`startDate` to `endDate` / `completedAt`).
  - Computes actual remaining work up to the current wall-clock date based on task `updatedAt` completion timestamps. Future sprint dates cleanly leave `actual` as `null` so charts stop plotting at today.
- **Scope Change & Carryover Detection**:
  - `scopeAdded`: Identifies tasks added to the sprint after iteration start (`createdAt > sprintStart + 24h`).
  - `carryover`: Identifies incomplete tasks (`status != 'done'`) remaining at sprint conclusion or current date.
- **Historical Sprint Velocity**:
  - Compares committed vs completed work across all project sprints in chronological order.
  - Computes dynamic team average velocity across completed and active iterations.
- **Custom Workflow & Rollover Invariants**:
  - Uses category-aware completion (`isStatusCompleted`, `getCompletedStatusKeys`) against custom project workflows.
- **Empty State & Timezone Boundaries**:
  - Safely handles sprints with 0 tasks or single-day ranges without dividing by zero.
  - Normalizes day boundary intervals using UTC day start/end timestamps.

### Permissions & Anti-IDOR Enforcement:
- Access to sprint velocity (`GET /api/analytics/project/:projectId/velocity`) requires verified project team membership via `checkProjectAccess`.
- Access to sprint burndown (`GET /api/analytics/sprint/:sprintId/burndown`) requires verified sprint/project access via `checkSprintAccess`.
- Cross-tenant requests are rejected with `403 Forbidden`.

### API Endpoints:
| Endpoint | Method | Required Permission / Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/analytics/project/:projectId/velocity` | `GET` | Project Team Member / Owner | Historical sprint velocity comparison and average velocity |
| `/api/analytics/sprint/:sprintId/burndown` | `GET` | Project Team Member / Owner | Sprint burndown chart timeline, scope changes, and carryover |

---

## 29. Team Workload & Capacity Analysis (ANL-03)

### Overview & Data Architecture:
Provides real-time team workload distribution and capacity analysis across project members. Enables teams to monitor committed workload vs available member capacity, identify overallocated members, detect workload imbalances, and surface unassigned or unestimated tasks without fabricated availability data or double-counting multi-assigned tasks.

### Metrics & Aggregation Engine:
- **Workload Per Member**:
  - Aggregates assigned task count, completed tasks, pending tasks, overdue tasks, and unestimated tasks per project team member.
  - Pre-seeds ALL project team members from the project's parent team so members with 0 tasks are prominently surfaced.
- **Sprint Capacity Per Member**:
  - Sprints can configure overall `capacity` and granular `memberCapacities: [{ userId, capacity }]`.
  - When specific member capacity is configured, it is utilized directly; otherwise, capacity falls back predictably to `sprint.capacity / teamMembers.length` or a standard default capacity (40h).
  - Clearly distinguishes configured capacity from committed workload.
- **Multi-Assignee Workload Distribution**:
  - Tasks with multiple assignees in `assignedTo` divide task work evenly across all assignees (`work / assignees.length`), preventing artificial work inflation or double-counting.
- **Utilization & Over-Allocation Warnings**:
  - Computes utilization percentage: `(committedWork / capacity) * 100`.
  - Flags `isOverAllocated: true` when committed work strictly exceeds configured member capacity.
  - Visual color indicators: Green (optimal / available, <80%), Amber (near capacity, 80–100%), Red (overloaded, >100%).
- **Workload Imbalance & Standard Deviation**:
  - Calculates mean work per member and population standard deviation across active members.
  - Flags `isImbalanced: true` when standard deviation exceeds 50% of the mean workload.
- **Unassigned Work & Estimation Risk**:
  - Directly aggregates unassigned task count and unassigned work value.
  - Counts unestimated tasks (`estimatedHours == null || estimatedHours === 0`), surfacing estimation gaps before sprint commitment.
- **Measurement Units**:
  - Supports both `estimatedHours` (default) and `storyPoints` independently without mixing units.
- **Multi-Attribute Filtering**:
  - Supports filtering by `sprintId`, `memberId`, date `range` (`all`, `today`, `this_week`, `this_month`, `last_30_days`, `custom`), and `unit`.

### Permissions & Anti-IDOR Enforcement:
- Access to team workload and capacity analysis (`GET /api/analytics/project/:projectId/workload-capacity`) strictly requires verified project team membership via `checkProjectAccess`.
- Updating sprint member capacity configurations requires project team member or owner privileges.
- Cross-tenant requests or unauthenticated requests are rejected with `401 Unauthorized` or `403 Forbidden`.

### API Endpoints:
| Endpoint | Method | Required Permission / Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/analytics/project/:projectId/workload-capacity` | `GET` | Project Team Member / Owner | Team workload distribution, member capacity, utilization rates, unassigned tasks, and imbalance analysis |
| `/api/sprints` | `POST` | Project Team Member / Owner | Create sprint with optional `capacity` and `memberCapacities` |
| `/api/sprints/:sprintId` | `PUT` | Project Team Member / Owner | Update sprint capacity and `memberCapacities` |

---

## 30. Task Completion & Cycle-Time Metrics (ANL-04)

### Overview & Data Architecture:
Provides real-time task completion throughput trends, cycle time, lead time, statistical percentiles, and workflow stage bottleneck analysis using actual persisted timestamps and transition histories. Does not infer historical status changes from `updatedAt` or fabricate missing start dates.

### Metrics & Aggregation Engine:
- **Cycle Time & Lead Time**:
  - `Lead Time`: Exact elapsed duration from task creation (`createdAt`) to completion (`completedAt`).
  - `Cycle Time`: Exact elapsed duration from active task start (`startedAt`) to completion (`completedAt`).
  - `Data Reliability Invariant`: Tasks without actual persisted start dates omit cycle time rather than fabricating start times or defaulting to zero.
- **Statistical Percentiles & Distribution**:
  - Computes `average`, `median (p50)`, `85th percentile (p85)`, `90th percentile (p90)`, `95th percentile (p95)`, `min`, and `max` for cycle and lead time durations.
  - Clearly distinguishes unavailable historical metrics from 0 hours (`null` values returned when insufficient data exists).
- **Completion Throughput Trends**:
  - Aggregates completed task counts across flexible temporal intervals: `daily` (by date), `weekly` (by week start), and `monthly` (by year-month).
- **Workflow Stage Bottleneck Analysis**:
  - Accurately computes dwell time spent in each workflow status stage using persisted `statusHistory` entries (`enteredAt`, `exitedAt`, `durationMs`).
  - Dynamically integrates with custom project workflows, displaying custom stage names, categories, and theme colors.
- **Completion Rates & Reopened Task Tracking**:
  - Identifies reopened tasks by detecting tasks that transitioned out of a `done` category status back into an active status.
  - Measures on-time vs overdue completion rates by comparing task `completedAt` timestamps against configured `dueDate` values.
- **Multi-Attribute Filtering**:
  - Supports filtering completion analytics by `sprintId`, `memberId` (assignee), `priority`, and date `range` (including custom start and end dates).

### Permissions & Anti-IDOR Enforcement:
- Access to task completion and cycle time analytics (`GET /api/analytics/project/:projectId/completion-cycle-time`) strictly requires verified project team membership via `checkProjectAccess`.
- Cross-tenant requests or unauthenticated requests are rejected with `401 Unauthorized` or `403 Forbidden`.

### API Endpoints:
| Endpoint | Method | Required Permission / Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/analytics/project/:projectId/completion-cycle-time` | `GET` | Project Team Member / Owner | Task completion trends, cycle/lead times, statistical percentiles, stage bottlenecks, and reopen rates |

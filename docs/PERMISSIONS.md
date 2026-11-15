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

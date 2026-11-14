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

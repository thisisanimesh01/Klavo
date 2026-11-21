# Klavo Advanced Automation Engine Architecture (AUTO-01)

## 1. Overview
The Klavo Advanced Automation Engine provides enterprise-grade, deterministic, event-driven and scheduled workflow automation. It executes complex conditional logic, branching pathways (`actions` vs. `elseActions`), multi-action dispatch (task mutations, generic webhooks, Slack alerts, and subtask generation), loop prevention, distributed synchronization, and dry-run execution testing.

---

## 2. Core Architecture & Components

```
+-------------------------------------------------------------+
|                      Event Emitters                         |
|   (Task Created, Status Changed, Priority, Due Date, Cron)  |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|              Automation Engine Core Evaluator               |
|   - Trigger Constraint Matching (fromValue -> toValue)      |
|   - Multi-Condition Evaluation (AND / OR Match Modes)       |
|   - Logical Branching (actions vs elseActions)              |
|   - Recursion & Loop Prevention (Max Depth = 3, seenRules)  |
+------------------------------+------------------------------+
                               |
                               +-------------------+
                               |                   |
                               v                   v
                    +--------------------+ +--------------------+
                    | Primary Actions    | | Else Branch Actions|
                    | (Conditions Pass)  | | (Conditions Fail)  |
                    +---------+----------+ +---------+----------+
                              |                      |
                              +----------+-----------+
                                         |
                                         v
                 +-----------------------------------------------+
                 |              Action Execution                 |
                 | - State Mutations (Status, Priority, Due Date)|
                 | - Multi-Assignee & Label Management           |
                 | - Outbound Webhooks (HMAC-SHA256 signature)   |
                 | - Slack Channel & Incoming Webhook Alerts     |
                 | - Automated Task / Subtask Creation           |
                 +-----------------------+-----------------------+
                                         |
                                         v
                 +-----------------------------------------------+
                 |             Persistence & Audit               |
                 | - Atomic Mongo Task Mutations & Socket Event  |
                 | - AutomationLog Audit Trail Record            |
                 | - Incremented Rule Counters                   |
                 +-----------------------------------------------+
```

---

## 3. Key Capabilities

### 3.1 Logical Grouping (`AND` / `OR`)
- Rules support `conditionMatchMode: "AND"` (default, all conditions must evaluate to true) and `conditionMatchMode: "OR"` (matches if any condition evaluates to true).
- Evaluators support string, array, and date operations: `equals`, `not_equals`, `in`, `not_in`, `is_empty`, `is_not_empty`, and substring `contains` (e.g., matching titles or tags).

### 3.2 Branching Logic (`elseActions`)
- If a rule's trigger matches but its conditions fail, the engine evaluates whether `elseActions` are defined.
- If defined, `elseActions` execute seamlessly, allowing fallback routing, reassignment, or state adjustments without requiring multiple disconnected rules.

### 3.3 Multi-Action Dispatch
- **Mutations**: `set_status`, `set_priority`, `assign_user`, `add_assignee`, `remove_assignee`, `add_label`, `set_due_date_relative`.
- **Integrations**:
  - `dispatch_webhook`: Outbound webhook events via `IntegrationService` with HMAC signatures and exponential retry backoff.
  - `send_slack_alert`: Direct incoming webhook notifications with channel routing.
  - `create_task`: Automated task or subtask generation.

### 3.4 Dry-Run Simulation Mode (`POST /api/automations/rules/:ruleId/test`)
- Allows workspace administrators to test and verify rule execution against a real or synthetic task payload.
- Predicts condition evaluation, branch taken (`actions` vs `elseActions`), simulated mutations, and potential action errors **without mutating database state**.

### 3.5 Infinite Loop & Cascade Safeguards
- **Max Execution Depth**: Capped at `MAX_EXECUTION_DEPTH = 3` to prevent cascading storm conditions.
- **Cycle Prevention**: The execution context carries a `seenRules` set through recursive calls; executing the same rule twice in a single call-chain is halted and logged as `skipped`.

### 3.6 Tenancy & RBAC
- Rule creation, modification, and deletion are strictly protected by `checkProjectAccess` and `resolveWorkspaceRole`. Only workspace **Owners** and **Admins** have permission to configure automation rules.

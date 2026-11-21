import AutomationRule from "../models/AutomationRule.js";
import AutomationLog from "../models/AutomationLog.js";
import Task from "../models/Task.js";
import { createTargetedNotification } from "./notificationHelpers.js";
import { integrationService } from "../services/integrationService.js";
import { acquireDistributedLock, releaseDistributedLock } from "./distributedLock.js";
import { logger } from "./logger.js";
import { metrics } from "./metrics.js";

const MAX_EXECUTION_DEPTH = 3;

/**
 * Checks if a task fulfills a specific condition.
 */
export const evaluateCondition = (task, condition) => {
  if (!condition || !task) return true;
  const { field, operator, value } = condition;
  const taskVal = task[field];

  switch (operator) {
    case "equals":
      if (Array.isArray(taskVal)) {
        return taskVal.some((v) => (v?._id || v)?.toString() === (value?._id || value)?.toString());
      }
      return (taskVal?._id || taskVal)?.toString() === (value?._id || value)?.toString();

    case "not_equals":
      if (Array.isArray(taskVal)) {
        return !taskVal.some((v) => (v?._id || v)?.toString() === (value?._id || value)?.toString());
      }
      return (taskVal?._id || taskVal)?.toString() !== (value?._id || value)?.toString();

    case "in":
      if (!Array.isArray(value)) return false;
      return value.map((v) => v?.toString()).includes((taskVal?._id || taskVal)?.toString());

    case "not_in":
      if (!Array.isArray(value)) return true;
      return !value.map((v) => v?.toString()).includes((taskVal?._id || taskVal)?.toString());

    case "is_empty":
      if (Array.isArray(taskVal)) return taskVal.length === 0;
      return taskVal === null || taskVal === undefined || taskVal === "";

    case "is_not_empty":
      if (Array.isArray(taskVal)) return taskVal.length > 0;
      return taskVal !== null && taskVal !== undefined && taskVal !== "";

    case "contains":
      if (Array.isArray(taskVal)) {
        // e.g. labels: array of { name }
        return taskVal.some((item) =>
          typeof item === "string"
            ? item.toLowerCase().includes(String(value).toLowerCase())
            : item?.name?.toLowerCase().includes(String(value).toLowerCase())
        );
      }
      return String(taskVal || "").toLowerCase().includes(String(value).toLowerCase());

    default:
      return true;
  }
};

/**
 * Checks if a rule matches an event trigger and its conditions (supporting AND/OR).
 */
export const doesRuleMatch = (rule, eventPayload) => {
  const { event, task, previousTask } = eventPayload;

  // 1. Trigger event check
  if (rule.trigger?.event !== event) return false;

  // 2. Trigger constraint checks (e.g. fromValue -> toValue)
  if (rule.trigger?.fromValue && previousTask) {
    let prevFieldVal = null;
    if (event === "status_changed") prevFieldVal = previousTask.status;
    else if (event === "priority_changed") prevFieldVal = previousTask.priority;
    if (prevFieldVal && prevFieldVal !== rule.trigger.fromValue) return false;
  }

  if (rule.trigger?.toValue) {
    let currentFieldVal = null;
    if (event === "status_changed") currentFieldVal = task.status;
    else if (event === "priority_changed") currentFieldVal = task.priority;
    if (currentFieldVal && currentFieldVal !== rule.trigger.toValue) return false;
  }

  // 3. Conditions evaluation (supporting AND / OR grouping)
  if (Array.isArray(rule.conditions) && rule.conditions.length > 0) {
    const mode = rule.conditionMatchMode === "OR" ? "OR" : "AND";
    if (mode === "OR") {
      const anyMatch = rule.conditions.some((cond) => evaluateCondition(task, cond));
      if (!anyMatch) return false;
    } else {
      for (const cond of rule.conditions) {
        if (!evaluateCondition(task, cond)) {
          return false;
        }
      }
    }
  }

  return true;
};

/**
 * Executes a single action against a task.
 * Returns any mutations made to the target task.
 */
export const executeAction = async (action, task, io, userId, ruleName, options = {}) => {
  const { type, payload } = action;
  const updates = {};
  const isSimulation = Boolean(options.isSimulation);

  switch (type) {
    case "set_status": {
      if (typeof payload === "string" && payload.trim()) {
        updates.status = payload.trim();
        task.status = payload.trim();
      }
      break;
    }

    case "set_priority": {
      if (["low", "medium", "high", "critical", "urgent"].includes(payload)) {
        updates.priority = payload;
        task.priority = payload;
      }
      break;
    }

    case "assign_user": {
      if (payload) {
        updates.assignedTo = [payload];
        task.assignedTo = [payload];
      }
      break;
    }

    case "add_assignee": {
      if (payload) {
        const existing = (task.assignedTo || []).map((u) => (u._id || u).toString());
        if (!existing.includes(payload.toString())) {
          existing.push(payload);
          updates.assignedTo = existing;
          task.assignedTo = existing;
        }
      }
      break;
    }

    case "remove_assignee": {
      if (payload) {
        const filtered = (task.assignedTo || []).filter(
          (u) => (u._id || u).toString() !== payload.toString()
        );
        updates.assignedTo = filtered;
        task.assignedTo = filtered;
      }
      break;
    }

    case "add_label": {
      const lblName = typeof payload === "string" ? payload : payload?.name;
      const lblColor = payload?.color || "#6366f1";
      if (lblName) {
        const existingLabels = task.labels ? [...task.labels] : [];
        if (!existingLabels.some((l) => (l.name || l).toLowerCase() === lblName.toLowerCase())) {
          existingLabels.push({ name: lblName, color: lblColor });
          updates.labels = existingLabels;
          task.labels = existingLabels;
        }
      }
      break;
    }

    case "set_due_date_relative": {
      const days = Number(payload) || 1;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      updates.dueDate = targetDate;
      task.dueDate = targetDate;
      break;
    }

    case "send_notification": {
      if (io && payload?.userId && !isSimulation) {
        await createTargetedNotification(io, {
          userId: payload.userId,
          senderId: userId || null,
          type: "AUTOMATION_TRIGGERED",
          message: payload.message || `Automation rule "${ruleName}" triggered on task "${task.title}"`,
          data: { taskId: task._id, projectId: task.projectId },
        });
      }
      break;
    }

    case "dispatch_webhook": {
      if (!isSimulation) {
        await integrationService.dispatchEvent({
          workspaceId: task.workspaceId || payload?.workspaceId,
          event: payload?.event || "automation.action_triggered",
          payload: {
            ruleName,
            taskId: task._id,
            taskTitle: task.title,
            projectId: task.projectId,
            customPayload: payload?.data || {},
          },
          projectId: task.projectId,
          fetchFn: options.fetchFn || globalThis.fetch,
        });
      }
      break;
    }

    case "send_slack_alert": {
      if (!isSimulation && payload?.webhookUrl) {
        await integrationService.sendSlackNotification({
          webhookUrl: payload.webhookUrl,
          message: payload.message || `[Automation] Rule "${ruleName}" executed on task: ${task.title}`,
          channel: payload.channel || null,
          fetchFn: options.fetchFn || globalThis.fetch,
        });
      }
      break;
    }

    case "create_task": {
      if (!isSimulation && payload?.title) {
        const newTask = await Task.create({
          title: payload.title,
          description: payload.description || `Spawned by automation rule: ${ruleName}`,
          projectId: task.projectId,
          status: payload.status || "todo",
          priority: payload.priority || "medium",
          assignedTo: payload.assignedTo || [],
          createdBy: userId || task.createdBy,
        });

        if (io) {
          io.to(`project_${task.projectId}`).emit("taskCreated", newTask);
        }
      }
      break;
    }

    default:
      break;
  }

  return updates;
};

/**
 * Simulates an automation rule against a task payload without mutating the database (Dry-Run).
 *
 * @param {object} rule - The automation rule
 * @param {object} task - Target task object
 * @returns {object} Simulation results
 */
export const simulateAutomationRule = async (rule, task) => {
  const dummyTaskCopy = JSON.parse(JSON.stringify(task || {}));
  const triggerMatches = true; // In manual test, trigger is tested directly on the task
  const conditionsPass = Array.isArray(rule.conditions) && rule.conditions.length > 0
    ? (rule.conditionMatchMode === "OR"
        ? rule.conditions.some((cond) => evaluateCondition(dummyTaskCopy, cond))
        : rule.conditions.every((cond) => evaluateCondition(dummyTaskCopy, cond)))
    : true;

  const targetActions = conditionsPass
    ? (rule.actions || [])
    : (rule.elseActions || []);

  const simulatedActions = [];
  let consolidatedUpdates = {};

  for (const action of targetActions) {
    try {
      const actionUpdates = await executeAction(
        action,
        dummyTaskCopy,
        null,
        null,
        rule.name,
        { isSimulation: true }
      );
      Object.assign(consolidatedUpdates, actionUpdates);
      simulatedActions.push({
        type: action.type,
        payload: action.payload,
        status: "predicted_success",
        simulatedMutations: actionUpdates,
      });
    } catch (err) {
      simulatedActions.push({
        type: action.type,
        payload: action.payload,
        status: "predicted_failure",
        error: err.message,
      });
    }
  }

  return {
    ruleId: rule._id,
    ruleName: rule.name,
    conditionMatchMode: rule.conditionMatchMode || "AND",
    conditionsEvaluated: (rule.conditions || []).map((c) => ({
      condition: c,
      passed: evaluateCondition(task, c),
    })),
    branchTaken: conditionsPass ? "actions" : (rule.elseActions?.length > 0 ? "elseActions" : "none"),
    simulatedActions,
    predictedTaskState: dummyTaskCopy,
    consolidatedUpdates,
  };
};

/**
 * Triggers automation rules for a given event on a task.
 * Safeguards against infinite loops using depth counter and call-chain tracking.
 * Supports conditional branching (elseActions) and distributed locking.
 */
export const runAutomationsForEvent = async (io, eventPayload) => {
  const { event, task, depth = 0, seenRules = new Set(), userId = null } = eventPayload;

  // Infinite loop protection: Limit maximum cascade depth
  if (depth >= MAX_EXECUTION_DEPTH) {
    logger.warn(`[AutomationEngine] Max depth (${MAX_EXECUTION_DEPTH}) reached for task ${task?._id}. Halting cascade.`);
    return;
  }

  if (!task || !task.projectId) return;

  try {
    const rules = await AutomationRule.find({
      projectId: task.projectId,
      isActive: true,
      "trigger.event": event,
    });

    if (!rules || rules.length === 0) return;

    for (const rule of rules) {
      // Prevent circular execution of the same rule in the same call chain
      if (seenRules.has(rule._id.toString())) {
        await AutomationLog.create({
          ruleId: rule._id,
          ruleName: rule.name,
          projectId: task.projectId,
          taskId: task._id,
          taskTitle: task.title || "",
          triggerEvent: event,
          status: "skipped",
          reason: "Prevented infinite automation loop: rule already executed in call chain",
          depth,
        });
        continue;
      }

      // Check if trigger matches
      if (rule.trigger?.event !== event) continue;

      // Check trigger constraints (fromValue / toValue)
      if (rule.trigger?.fromValue && eventPayload.previousTask) {
        let prevVal = null;
        if (event === "status_changed") prevVal = eventPayload.previousTask.status;
        else if (event === "priority_changed") prevVal = eventPayload.previousTask.priority;
        if (prevVal && prevVal !== rule.trigger.fromValue) continue;
      }

      if (rule.trigger?.toValue) {
        let currVal = null;
        if (event === "status_changed") currVal = task.status;
        else if (event === "priority_changed") currVal = task.priority;
        if (currVal && currVal !== rule.trigger.toValue) continue;
      }

      // Evaluate conditions
      let conditionsPass = true;
      if (Array.isArray(rule.conditions) && rule.conditions.length > 0) {
        const mode = rule.conditionMatchMode === "OR" ? "OR" : "AND";
        if (mode === "OR") {
          conditionsPass = rule.conditions.some((cond) => evaluateCondition(task, cond));
        } else {
          conditionsPass = rule.conditions.every((cond) => evaluateCondition(task, cond));
        }
      }

      // Branching: Choose actions or elseActions
      const targetActions = conditionsPass
        ? rule.actions
        : (Array.isArray(rule.elseActions) && rule.elseActions.length > 0 ? rule.elseActions : null);

      if (!targetActions || targetActions.length === 0) {
        continue;
      }

      const actionsExecuted = [];
      let consolidatedUpdates = {};

      for (const action of targetActions) {
        try {
          const actionUpdates = await executeAction(action, task, io, userId, rule.name);
          Object.assign(consolidatedUpdates, actionUpdates);
          actionsExecuted.push({
            type: action.type,
            payload: action.payload,
            status: "applied",
          });
        } catch (err) {
          actionsExecuted.push({
            type: action.type,
            payload: action.payload,
            status: "failed",
            error: err.message,
          });
        }
      }

      // Persist task updates if any mutations occurred
      if (Object.keys(consolidatedUpdates).length > 0) {
        await Task.updateOne({ _id: task._id }, { $set: consolidatedUpdates });

        // Populate and broadcast task update via socket
        const updatedTask = await Task.findById(task._id)
          .populate("assignedTo", "name email avatar")
          .populate("sprintId", "name status")
          .populate("milestoneId", "name status dueDate");

        if (io) {
          io.to(`project_${task.projectId}`).emit("taskUpdated", updatedTask);
          io.to(`project_${task.projectId}`).emit("automationExecuted", {
            ruleId: rule._id,
            ruleName: rule.name,
            taskId: task._id,
            branch: conditionsPass ? "primary" : "else",
            actions: actionsExecuted,
          });
        }

        // Check if mutations should cascade secondary automation triggers
        const nextSeen = new Set(seenRules);
        nextSeen.add(rule._id.toString());

        if (consolidatedUpdates.status && consolidatedUpdates.status !== task.status) {
          await runAutomationsForEvent(io, {
            event: "status_changed",
            task: updatedTask,
            previousTask: task,
            depth: depth + 1,
            seenRules: nextSeen,
            userId,
          });
        }

        if (consolidatedUpdates.priority && consolidatedUpdates.priority !== task.priority) {
          await runAutomationsForEvent(io, {
            event: "priority_changed",
            task: updatedTask,
            previousTask: task,
            depth: depth + 1,
            seenRules: nextSeen,
            userId,
          });
        }
      }

      // Record execution log and update rule counters
      await AutomationLog.create({
        ruleId: rule._id,
        ruleName: rule.name,
        projectId: task.projectId,
        taskId: task._id,
        taskTitle: task.title || "",
        triggerEvent: event,
        status: actionsExecuted.some((a) => a.status === "failed") ? "failed" : "success",
        actionsExecuted,
        depth,
        reason: conditionsPass ? "Primary actions applied" : "Branch elseActions applied",
      });

      rule.executionCount = (rule.executionCount || 0) + 1;
      rule.lastExecutedAt = new Date();
      await rule.save();
    }
  } catch (err) {
    metrics.recordAutomationExecution(true);
    logger.error("Error executing automations in AutomationEngine", {
      message: err.message,
      name: err.name,
      event,
      taskId: task?._id,
    });
  }
};

import AutomationRule from "../models/AutomationRule.js";
import AutomationLog from "../models/AutomationLog.js";
import Task from "../models/Task.js";
import { createTargetedNotification } from "./notificationHelpers.js";
import { logger } from "./logger.js";
import { metrics } from "./metrics.js";

const MAX_EXECUTION_DEPTH = 3;

/**
 * Checks if a task fulfills a specific condition.
 */
export const evaluateCondition = (task, condition) => {
  const { field, operator, value } = condition;
  const taskVal = task[field];

  switch (operator) {
    case "equals":
      if (Array.isArray(taskVal)) {
        return taskVal.some((v) => (v?._id || v).toString() === (value?._id || value).toString());
      }
      return (taskVal?._id || taskVal)?.toString() === (value?._id || value)?.toString();

    case "not_equals":
      if (Array.isArray(taskVal)) {
        return !taskVal.some((v) => (v?._id || v).toString() === (value?._id || value).toString());
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
 * Checks if a rule matches an event trigger and all attached conditions.
 */
export const doesRuleMatch = (rule, eventPayload) => {
  const { event, task, previousTask } = eventPayload;

  // 1. Trigger event check
  if (rule.trigger.event !== event) return false;

  // 2. Trigger constraint checks (e.g. fromValue -> toValue)
  if (rule.trigger.fromValue && previousTask) {
    let prevFieldVal = null;
    if (event === "status_changed") prevFieldVal = previousTask.status;
    else if (event === "priority_changed") prevFieldVal = previousTask.priority;
    if (prevFieldVal && prevFieldVal !== rule.trigger.fromValue) return false;
  }

  if (rule.trigger.toValue) {
    let currentFieldVal = null;
    if (event === "status_changed") currentFieldVal = task.status;
    else if (event === "priority_changed") currentFieldVal = task.priority;
    if (currentFieldVal && currentFieldVal !== rule.trigger.toValue) return false;
  }

  // 3. Conditions evaluation
  if (Array.isArray(rule.conditions) && rule.conditions.length > 0) {
    for (const cond of rule.conditions) {
      if (!evaluateCondition(task, cond)) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Executes a single action against a task.
 */
export const executeAction = async (action, task, io, userId, ruleName) => {
  const { type, payload } = action;
  const updates = {};

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
        const existingLabels = task.labels || [];
        if (!existingLabels.some((l) => l.name.toLowerCase() === lblName.toLowerCase())) {
          existingLabels.push({ name: lblName, color: lblColor });
          updates.labels = existingLabels;
          task.labels = existingLabels;
        }
      }
      break;
    }

    case "set_due_date_relative": {
      // payload: number of days from now, e.g. 3
      const days = Number(payload) || 1;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      updates.dueDate = targetDate;
      task.dueDate = targetDate;
      break;
    }

    case "send_notification": {
      if (io && payload?.userId) {
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

    default:
      break;
  }

  return updates;
};

/**
 * Triggers automation rules for a given event on a task.
 * Safeguards against infinite loops using depth counter and call-chain tracking.
 *
 * @param {object} io - Socket.io instance
 * @param {object} eventPayload
 * @param {string} eventPayload.event - 'task_created' | 'status_changed' | 'priority_changed' | 'assignee_changed' | 'due_date_changed'
 * @param {object} eventPayload.task - Target task
 * @param {object} [eventPayload.previousTask] - State of task prior to mutation
 * @param {string|ObjectId} [eventPayload.userId] - Requesting user
 * @param {number} [eventPayload.depth=0] - Recursion depth
 * @param {Set<string>} [eventPayload.seenRules=new Set()] - Set of rule IDs executed in this chain
 */
export const runAutomationsForEvent = async (io, eventPayload) => {
  const { event, task, depth = 0, seenRules = new Set(), userId = null } = eventPayload;

  // Infinite loop protection: Limit maximum cascade depth
  if (depth >= MAX_EXECUTION_DEPTH) {
    console.warn(`[AutomationEngine] Max depth (${MAX_EXECUTION_DEPTH}) reached for task ${task?._id}. Halting cascade.`);
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

      const isMatch = doesRuleMatch(rule, eventPayload);
      if (!isMatch) continue;

      const actionsExecuted = [];
      let consolidatedUpdates = {};

      for (const action of rule.actions) {
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

      // Record successful execution log and update rule counters
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

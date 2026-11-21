import AutomationRule from "../models/AutomationRule.js";
import AutomationLog from "../models/AutomationLog.js";
import RecurringTask from "../models/RecurringTask.js";
import Task from "../models/Task.js";
import { checkProjectAccess } from "../utils/authHelpers.js";
import { calculateNextRunDate, isRecurringExpired } from "../utils/recurringHelpers.js";
import { simulateAutomationRule, runAutomationsForEvent } from "../utils/automationEngine.js";

/**
 * Creates an automation rule for a project.
 * Requires Owner or Admin workspace role.
 */
export const createAutomationRule = async (req, res) => {
  try {
    const {
      name,
      description,
      projectId,
      trigger,
      conditionMatchMode,
      conditions,
      actions,
      elseActions,
      requiresApproval,
      isActive,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Rule name is required" });
    }

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    if (!trigger || !trigger.event) {
      return res.status(400).json({ message: "Trigger event is required" });
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ message: "At least one action is required" });
    }

    const { hasAccess, isAdmin, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // RBAC: Only Admin or Owner can create automation rules
    if (!hasAccess || !isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Only workspace owners and admins can configure automation rules",
      });
    }

    const rule = await AutomationRule.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      projectId,
      teamId: project.teamId,
      trigger,
      conditionMatchMode: conditionMatchMode === "OR" ? "OR" : "AND",
      conditions: Array.isArray(conditions) ? conditions : [],
      actions,
      elseActions: Array.isArray(elseActions) ? elseActions : [],
      requiresApproval: Boolean(requiresApproval),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      createdBy: req.user._id,
    });

    await rule.populate("createdBy", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("automationRuleCreated", rule);
    }

    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves all automation rules for a project.
 */
export const getAutomationRulesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view rules in this project" });
    }

    const rules = await AutomationRule.find({ projectId })
      .populate("createdBy", "name email avatar")
      .sort({ createdAt: -1 });

    res.json(rules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates an automation rule (including pause/resume).
 * Requires Owner or Admin workspace role.
 */
export const updateAutomationRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const {
      name,
      description,
      trigger,
      conditionMatchMode,
      conditions,
      actions,
      elseActions,
      requiresApproval,
      isActive,
    } = req.body;

    const rule = await AutomationRule.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });

    const { hasAccess, isAdmin } = await checkProjectAccess(rule.projectId, req.user._id);
    if (!hasAccess || !isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Only workspace owners and admins can modify automation rules",
      });
    }

    if (name && name.trim()) rule.name = name.trim();
    if (description !== undefined) rule.description = description.trim();
    if (trigger && trigger.event) rule.trigger = trigger;
    if (conditionMatchMode && ["AND", "OR"].includes(conditionMatchMode)) {
      rule.conditionMatchMode = conditionMatchMode;
    }
    if (Array.isArray(conditions)) rule.conditions = conditions;
    if (Array.isArray(actions) && actions.length > 0) rule.actions = actions;
    if (Array.isArray(elseActions)) rule.elseActions = elseActions;
    if (requiresApproval !== undefined) rule.requiresApproval = Boolean(requiresApproval);
    if (isActive !== undefined) rule.isActive = Boolean(isActive);

    await rule.save();
    await rule.populate("createdBy", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${rule.projectId}`).emit("automationRuleUpdated", rule);
    }

    res.json(rule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Deletes an automation rule.
 * Requires Owner or Admin workspace role.
 */
export const deleteAutomationRule = async (req, res) => {
  try {
    const { ruleId } = req.params;

    const rule = await AutomationRule.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });

    const { hasAccess, isAdmin } = await checkProjectAccess(rule.projectId, req.user._id);
    if (!hasAccess || !isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Only workspace owners and admins can delete automation rules",
      });
    }

    const projectId = rule.projectId;
    await rule.deleteOne();

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("automationRuleDeleted", { ruleId });
    }

    res.json({ message: "Automation rule deleted successfully", ruleId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Tests an automation rule against a task in simulation mode (Dry-run).
 * No database mutations will be applied.
 */
export const testAutomationRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { taskId, sampleTask } = req.body;

    const rule = await AutomationRule.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });

    const { hasAccess } = await checkProjectAccess(rule.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to test rules in this project" });
    }

    let targetTask = sampleTask;
    if (!targetTask && taskId) {
      targetTask = await Task.findById(taskId).lean();
    }

    if (!targetTask) {
      // Create a sensible fallback task snapshot for the simulation
      targetTask = {
        _id: "simulated_task_001",
        title: "Sample Task for Dry-Run Simulation",
        projectId: rule.projectId,
        status: "todo",
        priority: "medium",
        assignedTo: [req.user._id],
        labels: [{ name: "frontend", color: "#6366f1" }],
        dueDate: new Date(),
      };
    }

    const simulationResult = await simulateAutomationRule(rule, targetTask);
    res.json({
      success: true,
      simulation: simulationResult,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Manually triggers a scheduled automation rule on demand.
 */
export const triggerScheduledRuleNow = async (req, res) => {
  try {
    const { ruleId } = req.params;

    const rule = await AutomationRule.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });

    const { hasAccess, isAdmin } = await checkProjectAccess(rule.projectId, req.user._id);
    if (!hasAccess || !isAdmin) {
      return res.status(403).json({ message: "Forbidden: Only admins can trigger scheduled rules manually" });
    }

    const io = req.app.get("io");
    // Find active tasks in project to run against
    const tasks = await Task.find({ projectId: rule.projectId }).limit(10);
    let matchedCount = 0;

    for (const task of tasks) {
      await runAutomationsForEvent(io, {
        event: rule.trigger?.event || "scheduled_tick",
        task,
        userId: req.user._id,
      });
      matchedCount++;
    }

    res.json({
      message: "Scheduled rule execution triggered",
      tasksProcessed: matchedCount,
      ruleId: rule._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves execution logs for a project or specific rule.
 */
export const getAutomationLogs = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { ruleId, limit = 50 } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view logs in this project" });
    }

    const filter = { projectId };
    if (ruleId) filter.ruleId = ruleId;

    const logs = await AutomationLog.find(filter)
      .sort({ executedAt: -1 })
      .limit(Number(limit) || 50);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Creates a recurring task template schedule.
 */
export const createRecurringTask = async (req, res) => {
  try {
    const {
      title,
      description,
      projectId,
      status,
      priority,
      assignedTo,
      labels,
      estimatedHours,
      sprintId,
      milestoneId,
      frequency,
      interval,
      daysOfWeek,
      dayOfMonth,
      endDate,
      timezone,
      isActive,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to create recurring tasks in this project" });
    }

    const freq = frequency || "daily";
    const intv = Number(interval) || 1;
    const nextRunAt = calculateNextRunDate({
      frequency: freq,
      interval: intv,
      daysOfWeek: daysOfWeek || [],
      dayOfMonth: dayOfMonth || null,
      from: new Date(),
    });

    const recurring = await RecurringTask.create({
      title: title.trim(),
      description: description ? description.trim() : "",
      projectId,
      teamId: project.teamId,
      status: status || "todo",
      priority: priority || "medium",
      assignedTo: Array.isArray(assignedTo) ? assignedTo : [],
      labels: Array.isArray(labels) ? labels : [],
      estimatedHours: estimatedHours ? Number(estimatedHours) : null,
      sprintId: sprintId || null,
      milestoneId: milestoneId || null,
      frequency: freq,
      interval: intv,
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
      dayOfMonth: dayOfMonth ? Number(dayOfMonth) : null,
      endDate: endDate ? new Date(endDate) : null,
      timezone: timezone || "UTC",
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      nextRunAt,
      createdBy: req.user._id,
    });

    await recurring.populate("assignedTo", "name email avatar");
    await recurring.populate("createdBy", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("recurringTaskCreated", recurring);
    }

    res.status(201).json(recurring);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves all recurring task schedules for a project.
 */
export const getRecurringTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view recurring tasks in this project" });
    }

    const tasks = await RecurringTask.find({ projectId })
      .populate("assignedTo", "name email avatar")
      .populate("createdBy", "name email avatar")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Triggers an immediate task generation from a recurring task template (manual execution).
 */
export const triggerRecurringTaskNow = async (req, res) => {
  try {
    const { recurringId } = req.params;

    const recurring = await RecurringTask.findById(recurringId);
    if (!recurring) return res.status(404).json({ message: "Recurring task not found" });

    const { hasAccess } = await checkProjectAccess(recurring.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to trigger this recurring task" });
    }

    const newTask = await Task.create({
      title: recurring.title,
      description: recurring.description,
      status: recurring.status,
      priority: recurring.priority,
      assignedTo: recurring.assignedTo,
      labels: recurring.labels,
      estimatedHours: recurring.estimatedHours,
      sprintId: recurring.sprintId,
      milestoneId: recurring.milestoneId,
      projectId: recurring.projectId,
      createdBy: req.user._id,
    });

    await newTask.populate("assignedTo", "name email avatar");

    recurring.lastGeneratedAt = new Date();
    recurring.totalGenerated = (recurring.totalGenerated || 0) + 1;
    recurring.nextRunAt = calculateNextRunDate({
      frequency: recurring.frequency,
      interval: recurring.interval,
      daysOfWeek: recurring.daysOfWeek,
      dayOfMonth: recurring.dayOfMonth,
      from: new Date(),
    });

    if (recurring.endDate && isRecurringExpired(recurring.endDate, recurring.nextRunAt)) {
      recurring.isActive = false;
    }

    await recurring.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${recurring.projectId}`).emit("taskCreated", newTask);
      io.to(`project_${recurring.projectId}`).emit("recurringTaskUpdated", recurring);
    }

    res.status(201).json({
      message: "Task created successfully from template",
      task: newTask,
      recurring,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates a recurring task configuration.
 */
export const updateRecurringTask = async (req, res) => {
  try {
    const { recurringId } = req.params;
    const updates = req.body;

    const recurring = await RecurringTask.findById(recurringId);
    if (!recurring) return res.status(404).json({ message: "Recurring task not found" });

    const { hasAccess } = await checkProjectAccess(recurring.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update this recurring task" });
    }

    const allowedFields = [
      "title",
      "description",
      "status",
      "priority",
      "assignedTo",
      "labels",
      "estimatedHours",
      "sprintId",
      "milestoneId",
      "frequency",
      "interval",
      "daysOfWeek",
      "dayOfMonth",
      "endDate",
      "timezone",
      "isActive",
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        recurring[field] = updates[field];
      }
    }

    if (updates.frequency || updates.interval || updates.daysOfWeek || updates.dayOfMonth) {
      recurring.nextRunAt = calculateNextRunDate({
        frequency: recurring.frequency,
        interval: recurring.interval,
        daysOfWeek: recurring.daysOfWeek,
        dayOfMonth: recurring.dayOfMonth,
        from: new Date(),
      });
    }

    await recurring.save();
    await recurring.populate("assignedTo", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${recurring.projectId}`).emit("recurringTaskUpdated", recurring);
    }

    res.json(recurring);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Deletes a recurring task configuration.
 */
export const deleteRecurringTask = async (req, res) => {
  try {
    const { recurringId } = req.params;

    const recurring = await RecurringTask.findById(recurringId);
    if (!recurring) return res.status(404).json({ message: "Recurring task not found" });

    const { hasAccess } = await checkProjectAccess(recurring.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to delete this recurring task" });
    }

    const projectId = recurring.projectId;
    await recurring.deleteOne();

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("recurringTaskDeleted", { recurringId });
    }

    res.json({ message: "Recurring task deleted successfully", recurringId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

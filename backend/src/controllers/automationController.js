import AutomationRule from "../models/AutomationRule.js";
import AutomationLog from "../models/AutomationLog.js";
import RecurringTask from "../models/RecurringTask.js";
import Task from "../models/Task.js";
import { checkProjectAccess } from "../utils/authHelpers.js";
import { calculateNextRunDate, isRecurringExpired } from "../utils/recurringHelpers.js";

/**
 * Creates an automation rule for a project.
 */
export const createAutomationRule = async (req, res) => {
  try {
    const { name, description, projectId, trigger, conditions, actions, isActive } = req.body;

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

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to create automation rules in this project" });
    }

    const rule = await AutomationRule.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      projectId,
      teamId: project.teamId,
      trigger,
      conditions: Array.isArray(conditions) ? conditions : [],
      actions,
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
 */
export const updateAutomationRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { name, description, trigger, conditions, actions, isActive } = req.body;

    const rule = await AutomationRule.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });

    const { hasAccess } = await checkProjectAccess(rule.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update this rule" });
    }

    if (name && name.trim()) rule.name = name.trim();
    if (description !== undefined) rule.description = description.trim();
    if (trigger && trigger.event) rule.trigger = trigger;
    if (Array.isArray(conditions)) rule.conditions = conditions;
    if (Array.isArray(actions) && actions.length > 0) rule.actions = actions;
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
 */
export const deleteAutomationRule = async (req, res) => {
  try {
    const { ruleId } = req.params;

    const rule = await AutomationRule.findById(ruleId);
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });

    const { hasAccess } = await checkProjectAccess(rule.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to delete this rule" });
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
      startDate,
      endDate,
      timezone,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    if (!frequency || !["daily", "weekly", "monthly"].includes(frequency)) {
      return res.status(400).json({ message: "Valid recurrence frequency is required (daily, weekly, monthly)" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to create recurring tasks in this project" });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const nextRun = calculateNextRunDate({
      frequency,
      interval: Number(interval) || 1,
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
      dayOfMonth: Number(dayOfMonth) || 1,
      from: start,
    });

    const recurring = await RecurringTask.create({
      title: title.trim(),
      description: description || "",
      projectId,
      teamId: project.teamId,
      status: status || "todo",
      priority: priority || "medium",
      assignedTo: Array.isArray(assignedTo) ? assignedTo : [],
      labels: Array.isArray(labels) ? labels : [],
      estimatedHours: estimatedHours !== undefined ? estimatedHours : null,
      sprintId: sprintId || null,
      milestoneId: milestoneId || null,
      frequency,
      interval: Number(interval) || 1,
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
      dayOfMonth: Number(dayOfMonth) || 1,
      startDate: start,
      endDate: endDate ? new Date(endDate) : null,
      timezone: timezone || "UTC",
      nextRunAt: nextRun,
      createdBy: req.user._id,
    });

    await recurring.populate("assignedTo", "name email avatar");

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
 * Retrieves all recurring task configurations for a project.
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
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Triggers manual generation / test execution of a recurring task instance.
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

    const taskCount = await Task.countDocuments({
      projectId: recurring.projectId,
      status: recurring.status,
    });

    // Create the task instance
    const createdTask = await Task.create({
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
      order: taskCount,
    });

    // Compute and advance next run date
    const nextRun = calculateNextRunDate({
      frequency: recurring.frequency,
      interval: recurring.interval,
      daysOfWeek: recurring.daysOfWeek,
      dayOfMonth: recurring.dayOfMonth,
      from: recurring.nextRunAt || new Date(),
    });

    recurring.lastGeneratedAt = new Date();
    recurring.totalGenerated = (recurring.totalGenerated || 0) + 1;
    recurring.nextRunAt = nextRun;

    if (isRecurringExpired(recurring.endDate, nextRun)) {
      recurring.isActive = false;
    }

    await recurring.save();

    await createdTask.populate("assignedTo", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${recurring.projectId}`).emit("taskCreated", createdTask);
      io.to(`project_${recurring.projectId}`).emit("recurringTaskUpdated", recurring);
    }

    res.status(201).json({
      message: "Recurring task instance generated successfully",
      task: createdTask,
      recurring,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates recurring task configuration (e.g. pause/resume or schedule edits).
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

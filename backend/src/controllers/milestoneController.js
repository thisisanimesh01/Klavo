import { getCompletedStatusKeys, isStatusCompleted } from "../utils/workflowHelpers.js";
import Workflow from "../models/Workflow.js";
import Milestone from "../models/Milestone.js";
import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { logActivity } from "./activityController.js";
import { checkProjectAccess, checkMilestoneAccess } from "../utils/authHelpers.js";

/**
 * Create a new milestone in a project.
 */
export const createMilestone = async (req, res) => {
  try {
    const { name, description, projectId, startDate, dueDate, ownerId, status } = req.body;

    if (!name || !projectId) {
      return res.status(400).json({ message: "Milestone name and projectId are required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to create milestones in this project" });
    }

    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      return res.status(400).json({ message: "Start date cannot be after due date" });
    }

    const validStatuses = ["planned", "in_progress", "completed", "archived"];
    const milestoneStatus = status && validStatuses.includes(status) ? status : "planned";

    const milestone = await Milestone.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      projectId,
      teamId: project.teamId,
      startDate: startDate || null,
      dueDate: dueDate || null,
      ownerId: ownerId || req.user._id,
      status: milestoneStatus,
      completedAt: milestoneStatus === "completed" ? new Date() : null,
      createdBy: req.user._id,
    });

    // Log activity
    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Created Milestone",
      message: `${req.user.name} created milestone "${milestone.name}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("milestoneCreated", milestone);
      io.to(`project_${projectId}`).emit("activityCreated", {
        projectId,
        user: { name: req.user.name },
        action: "Created Milestone",
        message: `${req.user.name} created milestone "${milestone.name}"`,
        createdAt: new Date(),
      });
    }

    res.status(201).json(milestone);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * List all milestones for a project, including calculated task metrics and overdue status.
 */
export const getMilestonesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view milestones in this project" });
    }

    const query = { projectId };
    if (status) {
      query.status = status;
    }

    const milestones = await Milestone.find(query)
      .populate("ownerId", "name email avatar")
      .populate("createdBy", "name email")
      .sort({ dueDate: 1, createdAt: -1 });

    const milestoneIds = milestones.map((m) => m._id);
    const projectWorkflow = await Workflow.findOne({ projectId });
    const tasks = await Task.find({ milestoneId: { $in: milestoneIds } }).select("milestoneId status estimatedHours");

    const now = new Date();

    const milestonesWithMetrics = milestones.map((m) => {
      const mTasks = tasks.filter((t) => t.milestoneId?.toString() === m._id.toString());
      const totalTasks = mTasks.length;
      const completedTasks = mTasks.filter((t) => isStatusCompleted(t.status, projectWorkflow)).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const isOverdue = Boolean(m.dueDate && new Date(m.dueDate) < now && m.status !== "completed" && m.status !== "archived");

      return {
        ...m.toObject(),
        totalTasks,
        completedTasks,
        progress,
        isOverdue,
      };
    });

    res.json(milestonesWithMetrics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get details of a single milestone including assigned tasks.
 */
export const getMilestoneById = async (req, res) => {
  try {
    const { milestoneId } = req.params;

    const { hasAccess, milestone, project } = await checkMilestoneAccess(milestoneId, req.user._id);
    if (!milestone) return res.status(404).json({ message: "Milestone not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view this milestone" });
    }

    await milestone.populate("ownerId", "name email avatar");
    await milestone.populate("createdBy", "name email");

    const tasks = await Task.find({ milestoneId: milestone._id })
      .populate("assignedTo", "name email avatar")
      .sort({ order: 1 });

    const totalTasks = tasks.length;
    const projectWorkflow = await Workflow.findOne({ projectId: milestone.projectId });
    const completedTasks = tasks.filter((t) => isStatusCompleted(t.status, projectWorkflow)).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const isOverdue = Boolean(
      milestone.dueDate &&
      new Date(milestone.dueDate) < new Date() &&
      milestone.status !== "completed" &&
      milestone.status !== "archived"
    );

    res.json({
      ...milestone.toObject(),
      totalTasks,
      completedTasks,
      progress,
      isOverdue,
      tasks,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update an existing milestone.
 */
export const updateMilestone = async (req, res) => {
  try {
    const { milestoneId } = req.params;
    const { name, description, startDate, dueDate, ownerId, status } = req.body;

    const { hasAccess, milestone, project } = await checkMilestoneAccess(milestoneId, req.user._id);
    if (!milestone) return res.status(404).json({ message: "Milestone not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update this milestone" });
    }

    const effectiveStart = startDate !== undefined ? startDate : milestone.startDate;
    const effectiveDue = dueDate !== undefined ? dueDate : milestone.dueDate;

    if (effectiveStart && effectiveDue && new Date(effectiveStart) > new Date(effectiveDue)) {
      return res.status(400).json({ message: "Start date cannot be after due date" });
    }

    if (name !== undefined) milestone.name = name.trim();
    if (description !== undefined) milestone.description = description.trim();
    if (startDate !== undefined) milestone.startDate = startDate || null;
    if (dueDate !== undefined) milestone.dueDate = dueDate || null;
    if (ownerId !== undefined) milestone.ownerId = ownerId || null;

    if (status !== undefined) {
      const validStatuses = ["planned", "in_progress", "completed", "archived"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status: ${status}` });
      }
      milestone.status = status;
      if (status === "completed" && !milestone.completedAt) {
        milestone.completedAt = new Date();
      } else if (status !== "completed") {
        milestone.completedAt = null;
      }
    }

    await milestone.save();
    await milestone.populate("ownerId", "name email avatar");

    await logActivity({
      projectId: milestone.projectId,
      userId: req.user._id,
      action: "Updated Milestone",
      message: `${req.user.name} updated milestone "${milestone.name}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${milestone.projectId}`).emit("milestoneUpdated", milestone);
    }

    res.json(milestone);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Batch assign or remove tasks to/from a milestone.
 */
export const assignTasksToMilestone = async (req, res) => {
  try {
    const { milestoneId } = req.params;
    const { taskIds, action } = req.body; // action: "assign" | "remove"

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: "taskIds must be a non-empty array" });
    }

    const { hasAccess, milestone, project } = await checkMilestoneAccess(milestoneId, req.user._id);
    if (!milestone) return res.status(404).json({ message: "Milestone not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update this milestone" });
    }

    const newMilestoneId = action === "remove" ? null : milestone._id;

    // Security: Only update tasks belonging to this project (prevent cross-project tampering)
    const result = await Task.updateMany(
      { _id: { $in: taskIds }, projectId: milestone.projectId },
      { milestoneId: newMilestoneId }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${milestone.projectId}`).emit("milestoneTasksUpdated", {
        milestoneId: milestone._id,
        taskIds,
        action,
      });
      io.to(`project_${milestone.projectId}`).emit("tasksBatchUpdated", {
        taskIds,
        milestoneId: newMilestoneId,
      });
    }

    res.json({
      message: `Successfully ${action === "remove" ? "removed" : "assigned"} tasks`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Delete a milestone. Associated tasks have their milestoneId set to null.
 */
export const deleteMilestone = async (req, res) => {
  try {
    const { milestoneId } = req.params;

    const { hasAccess, milestone, project } = await checkMilestoneAccess(milestoneId, req.user._id);
    if (!milestone) return res.status(404).json({ message: "Milestone not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to delete this milestone" });
    }

    // Unlink tasks
    await Task.updateMany({ milestoneId: milestone._id }, { milestoneId: null });

    await Milestone.findByIdAndDelete(milestoneId);

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${milestone.projectId}`).emit("milestoneDeleted", { _id: milestoneId });
    }

    res.json({ message: "Milestone deleted and tasks unlinked successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Fetch comprehensive Gantt/Timeline dataset for a project.
 * Aggregates all milestones, all tasks (with start/due dates, dependencies, assignees, sprints),
 * calculating timeline ranges, overdue flags, and dependency edges.
 */
export const getGanttTimeline = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { milestoneId, sprintId, assigneeId } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view timeline for this project" });
    }

    // 1. Fetch Milestones
    const milestoneQuery = { projectId };
    if (milestoneId && milestoneId !== "all") {
      milestoneQuery._id = milestoneId;
    }
    const milestones = await Milestone.find(milestoneQuery)
      .populate("ownerId", "name email avatar")
      .sort({ dueDate: 1, startDate: 1 });

    // 2. Fetch Tasks with dependencies
    const taskQuery = { projectId };
    if (sprintId && sprintId !== "all") {
      if (sprintId === "backlog") {
        taskQuery.sprintId = null;
      } else {
        taskQuery.sprintId = sprintId;
      }
    }
    if (milestoneId && milestoneId !== "all") {
      taskQuery.milestoneId = milestoneId;
    }
    if (assigneeId && assigneeId !== "all") {
      taskQuery.assignedTo = assigneeId;
    }

    const ganttWorkflow = await Workflow.findOne({ projectId });
    const tasks = await Task.find(taskQuery)
      .populate("assignedTo", "name email avatar")
      .populate("sprintId", "name status")
      .populate("milestoneId", "name status dueDate")
      .populate("dependencies.taskId", "title status dueDate")
      .sort({ dueDate: 1, createdAt: 1 });

    const now = new Date();

    // Map tasks into gantt items
    const ganttTasks = tasks.map((t) => {
      // If task has no explicit startDate, use createdAt or dueDate - 2 days
      const startDate = t.createdAt || new Date();
      const dueDate = t.dueDate || null;
      const isOverdue = Boolean(dueDate && new Date(dueDate) < now && !isStatusCompleted(t.status, ganttWorkflow));

      // Extract blocking dependencies
      const blockingDeps = (t.dependencies || [])
        .filter((d) => d.type === "blocked-by" || d.type === "blocks")
        .map((d) => ({
          targetTaskId: d.taskId?._id || d.taskId,
          targetTitle: d.taskId?.title,
          type: d.type,
          isResolved: isStatusCompleted(d.taskId?.status, ganttWorkflow),
        }));

      return {
        _id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        startDate,
        dueDate,
        estimatedHours: t.estimatedHours,
        assignedTo: t.assignedTo,
        sprint: t.sprintId,
        milestone: t.milestoneId,
        dependencies: blockingDeps,
        isOverdue,
        progress: isStatusCompleted(t.status, ganttWorkflow) ? 100 : t.status === "review" ? 75 : t.status === "in-progress" ? 50 : 0,
      };
    });

    // Map milestones into gantt items with progress
    const ganttMilestones = milestones.map((m) => {
      const associatedTasks = ganttTasks.filter(
        (t) => t.milestone?._id?.toString() === m._id.toString() || t.milestone?.toString() === m._id.toString()
      );
      const total = associatedTasks.length;
      const completed = associatedTasks.filter((t) => isStatusCompleted(t.status, ganttWorkflow)).length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      const isOverdue = Boolean(m.dueDate && new Date(m.dueDate) < now && m.status !== "completed" && m.status !== "archived");

      return {
        _id: m._id,
        name: m.name,
        description: m.description,
        status: m.status,
        startDate: m.startDate || m.createdAt,
        dueDate: m.dueDate,
        owner: m.ownerId,
        totalTasks: total,
        completedTasks: completed,
        progress,
        isOverdue,
      };
    });

    res.json({
      project: {
        _id: project._id,
        name: project.name,
      },
      milestones: ganttMilestones,
      tasks: ganttTasks,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

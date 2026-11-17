import { getCompletedStatusKeys, isStatusCompleted } from "../utils/workflowHelpers.js";
import Workflow from "../models/Workflow.js";
import Sprint from "../models/Sprint.js";
import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { logActivity } from "./activityController.js";
import { checkProjectAccess, checkSprintAccess } from "../utils/authHelpers.js";

/**
 * Create a new sprint in a project.
 */
export const createSprint = async (req, res) => {
  try {
    const { name, goal, projectId, startDate, endDate, capacity } = req.body;

    if (!name || !projectId) {
      return res.status(400).json({ message: "Sprint name and projectId are required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to create sprints in this project" });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ message: "Start date cannot be after end date" });
    }

    const sprint = await Sprint.create({
      name: name.trim(),
      goal: goal ? goal.trim() : "",
      projectId,
      teamId: project.teamId,
      startDate: startDate || null,
      endDate: endDate || null,
      capacity: capacity !== undefined && capacity !== "" ? Number(capacity) : null,
      status: "planned",
      createdBy: req.user._id,
    });

    // Log activity
    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Created Sprint",
      message: `${req.user.name} created sprint "${sprint.name}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("sprintCreated", sprint);
      io.to(`project_${projectId}`).emit("activityCreated", {
        projectId,
        user: { name: req.user.name },
        action: "Created Sprint",
        message: `${req.user.name} created sprint "${sprint.name}"`,
        createdAt: new Date(),
      });
    }

    res.status(201).json(sprint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * List all sprints for a project. Includes committed hours and capacity overload calculation.
 */
export const getSprintsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view sprints in this project" });
    }

    const query = { projectId };
    if (status) {
      query.status = status;
    }

    const sprints = await Sprint.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    // Calculate quick task stats and capacity metrics for each sprint
    const sprintIds = sprints.map((s) => s._id);
    const projectWorkflow = await Workflow.findOne({ projectId });
    const tasks = await Task.find({ sprintId: { $in: sprintIds } }).select("sprintId status estimatedHours");

    const sprintsWithStats = sprints.map((s) => {
      const sTasks = tasks.filter((t) => t.sprintId?.toString() === s._id.toString());
      const totalTasks = sTasks.length;
      const completedTasks = sTasks.filter((t) => isStatusCompleted(t.status, projectWorkflow)).length;
      const committedHours = sTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
      const capacity = s.capacity || null;
      const isOverloaded = capacity !== null && committedHours > capacity;
      const capacityUtilization = capacity !== null && capacity > 0 ? Math.round((committedHours / capacity) * 100) : null;

      return {
        ...s.toObject(),
        totalTasks,
        completedTasks,
        committedHours,
        isOverloaded,
        capacityUtilization,
        progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      };
    });

    res.json(sprintsWithStats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get details for a specific sprint, including full task list and capacity stats.
 */
export const getSprintById = async (req, res) => {
  try {
    const { sprintId } = req.params;

    const { hasAccess, sprint, project } = await checkSprintAccess(sprintId, req.user._id);
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view this sprint" });
    }

    await sprint.populate("createdBy", "name email");

    const tasks = await Task.find({ sprintId })
      .populate("assignedTo", "name email avatar")
      .sort({ status: 1, order: 1 });

    const totalTasks = tasks.length;
    const projectWorkflow = await Workflow.findOne({ projectId: sprint.projectId });
    const completedTasks = tasks.filter((t) => isStatusCompleted(t.status, projectWorkflow)).length;
    const committedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const capacity = sprint.capacity || null;
    const isOverloaded = capacity !== null && committedHours > capacity;
    const capacityUtilization = capacity !== null && capacity > 0 ? Math.round((committedHours / capacity) * 100) : null;

    res.json({
      ...sprint.toObject(),
      tasks,
      totalTasks,
      completedTasks,
      committedHours,
      isOverloaded,
      capacityUtilization,
      progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update sprint details (name, goal, dates, capacity).
 */
export const updateSprint = async (req, res) => {
  try {
    const { sprintId } = req.params;

    const { hasAccess, sprint, project } = await checkSprintAccess(sprintId, req.user._id);
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update this sprint" });
    }

    const { name, goal, startDate, endDate, capacity } = req.body;

    if (name) sprint.name = name.trim();
    if (goal !== undefined) sprint.goal = goal ? goal.trim() : "";
    if (startDate !== undefined) sprint.startDate = startDate || null;
    if (endDate !== undefined) sprint.endDate = endDate || null;
    if (capacity !== undefined) sprint.capacity = capacity !== "" && capacity !== null ? Number(capacity) : null;

    if (sprint.startDate && sprint.endDate && new Date(sprint.startDate) > new Date(sprint.endDate)) {
      return res.status(400).json({ message: "Start date cannot be after end date" });
    }

    await sprint.save();

    await logActivity({
      projectId: sprint.projectId,
      userId: req.user._id,
      action: "Updated Sprint",
      message: `${req.user.name} updated sprint "${sprint.name}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${sprint.projectId}`).emit("sprintUpdated", sprint);
    }

    res.json(sprint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Start a sprint (transitions from 'planned' to 'active').
 * Enforces business rule: Only one active sprint per project at a time.
 */
export const startSprint = async (req, res) => {
  try {
    const { sprintId } = req.params;

    const { hasAccess, sprint, project } = await checkSprintAccess(sprintId, req.user._id);
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to start this sprint" });
    }

    if (sprint.status === "active") {
      return res.status(400).json({ message: "Sprint is already active" });
    }

    if (sprint.status === "completed" || sprint.status === "archived") {
      return res.status(400).json({ message: "Cannot start a completed or archived sprint" });
    }

    // Check if another sprint is already active in this project
    const activeSprint = await Sprint.findOne({
      projectId: sprint.projectId,
      status: "active",
      _id: { $ne: sprint._id },
    });

    if (activeSprint) {
      return res.status(400).json({
        message: `Project already has an active sprint ("${activeSprint.name}"). Complete it before starting a new one.`,
      });
    }

    sprint.status = "active";
    if (!sprint.startDate) {
      sprint.startDate = new Date();
    }
    await sprint.save();

    await logActivity({
      projectId: sprint.projectId,
      userId: req.user._id,
      action: "Started Sprint",
      message: `${req.user.name} started sprint "${sprint.name}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${sprint.projectId}`).emit("sprintStarted", sprint);
      io.to(`project_${sprint.projectId}`).emit("activityCreated", {
        projectId: sprint.projectId,
        user: { name: req.user.name },
        action: "Started Sprint",
        message: `${req.user.name} started sprint "${sprint.name}"`,
        createdAt: new Date(),
      });
    }

    res.json(sprint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Complete a sprint (transitions to 'completed').
 * Incomplete tasks can be moved to the product backlog (sprintId: null)
 * or to a target sprint.
 */
export const completeSprint = async (req, res) => {
  try {
    const { sprintId } = req.params;
    const { targetSprintId } = req.body;

    const { hasAccess, sprint, project } = await checkSprintAccess(sprintId, req.user._id);
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to complete this sprint" });
    }

    if (sprint.status !== "active") {
      return res.status(400).json({ message: "Only active sprints can be completed" });
    }

    sprint.status = "completed";
    sprint.completedAt = new Date();
    await sprint.save();

    // Rollover incomplete tasks
    let rolloverDestination = null;
    if (targetSprintId) {
      const { hasAccess: targetAccess, sprint: targetSprint } = await checkSprintAccess(
        targetSprintId,
        req.user._id
      );
      if (targetAccess && targetSprint) {
        rolloverDestination = targetSprint._id;
      }
    }

    const sprintWorkflow = await Workflow.findOne({ projectId: sprint.projectId });
    const doneKeys = getCompletedStatusKeys(sprintWorkflow);
    const uncompletedTasks = await Task.updateMany(
      { sprintId: sprint._id, status: { $nin: doneKeys } },
      { sprintId: rolloverDestination }
    );

    await logActivity({
      projectId: sprint.projectId,
      userId: req.user._id,
      action: "Completed Sprint",
      message: `${req.user.name} completed sprint "${sprint.name}" (${uncompletedTasks.modifiedCount} tasks rolled over)`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${sprint.projectId}`).emit("sprintCompleted", {
        sprint,
        rolledOverTasksCount: uncompletedTasks.modifiedCount,
      });
      io.to(`project_${sprint.projectId}`).emit("activityCreated", {
        projectId: sprint.projectId,
        user: { name: req.user.name },
        action: "Completed Sprint",
        message: `${req.user.name} completed sprint "${sprint.name}"`,
        createdAt: new Date(),
      });
    }

    res.json({
      sprint,
      rolledOverTasksCount: uncompletedTasks.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Archive a sprint.
 */
export const archiveSprint = async (req, res) => {
  try {
    const { sprintId } = req.params;

    const { hasAccess, sprint } = await checkSprintAccess(sprintId, req.user._id);
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to archive this sprint" });
    }

    sprint.status = "archived";
    sprint.archivedAt = new Date();
    await sprint.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${sprint.projectId}`).emit("sprintArchived", sprint);
    }

    res.json(sprint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Batch assign or remove tasks to/from a sprint.
 */
export const assignTasksToSprint = async (req, res) => {
  try {
    const { sprintId } = req.params;
    const { taskIds, action } = req.body; // action: 'assign' | 'remove'

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: "taskIds must be a non-empty array" });
    }

    const { hasAccess, sprint, project } = await checkSprintAccess(sprintId, req.user._id);
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update this sprint" });
    }

    const newSprintId = action === "remove" ? null : sprint._id;

    // Only update tasks belonging to this project (prevent cross-project tampering)
    const result = await Task.updateMany(
      { _id: { $in: taskIds }, projectId: sprint.projectId },
      { sprintId: newSprintId }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${sprint.projectId}`).emit("sprintTasksUpdated", {
        sprintId: sprint._id,
        taskIds,
        action,
      });
      io.to(`project_${sprint.projectId}`).emit("tasksBatchUpdated", {
        taskIds,
        sprintId: newSprintId,
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
 * Delete a planned sprint. Active or completed sprints should be completed/archived.
 */
export const deleteSprint = async (req, res) => {
  try {
    const { sprintId } = req.params;

    const { hasAccess, sprint } = await checkSprintAccess(sprintId, req.user._id);
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to delete this sprint" });
    }

    if (sprint.status === "active") {
      return res.status(400).json({ message: "Cannot delete an active sprint. Complete or archive it first." });
    }

    // Move associated tasks back to backlog
    await Task.updateMany({ sprintId: sprint._id }, { sprintId: null });

    await Sprint.findByIdAndDelete(sprintId);

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${sprint.projectId}`).emit("sprintDeleted", { _id: sprintId });
    }

    res.json({ message: "Sprint deleted and tasks returned to backlog" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

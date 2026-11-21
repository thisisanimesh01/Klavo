import { isStatusCompleted, getCompletedStatusKeys, getStatusCategory } from "../utils/workflowHelpers.js";
import Workflow from "../models/Workflow.js";
import Task from "../models/Task.js";
import TaskTemplate from "../models/TaskTemplate.js";
import Sprint from "../models/Sprint.js";
import { Project } from "../models/Project.js";
import { logActivity } from "./activityController.js";
import { checkProjectAccess, checkTaskAccess } from "../utils/authHelpers.js";
import { createTargetedNotification } from "../utils/notificationHelpers.js";
import { detectCircularDependency, checkTaskBlockers } from "../utils/dependencyHelpers.js";
import { buildTaskFilterQuery, buildTaskSortConfig } from "../utils/filterHelpers.js";
import { runAutomationsForEvent } from "../utils/automationEngine.js";

export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      projectId,
      priority,
      sprintId,
      milestoneId,
      parentId,
      dependencies,
      dueDate,
      assignedTo,
      labels,
      customFields,
      checklist,
      estimatedHours,
      templateId,
    } = req.body;

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to create tasks in this project" });
    }

    // If parentId provided, verify it exists and belongs to the same project
    if (parentId) {
      const parentTask = await Task.findOne({ _id: parentId, projectId });
      if (!parentTask) {
        return res.status(400).json({ message: "Parent task not found or belongs to a different project" });
      }
    }

    let finalTitle = title ? title.trim() : "";
    let finalDescription = description || "";
    let finalPriority = priority || "medium";
    let finalLabels = Array.isArray(labels) ? labels : [];
    let finalCustomFields = Array.isArray(customFields) ? customFields : [];
    let finalChecklist = Array.isArray(checklist) ? checklist : [];
    let finalEstimatedHours = estimatedHours !== undefined ? estimatedHours : null;
    let finalStoryPoints = storyPoints !== undefined ? storyPoints : null;

    // If templateId provided, apply template defaults if fields not explicitly provided
    if (templateId) {
      const template = await TaskTemplate.findById(templateId);
      if (template) {
        if (!finalTitle && template.defaultTitle) finalTitle = template.defaultTitle;
        if (!finalDescription && template.defaultDescription) finalDescription = template.defaultDescription;
        if (!priority && template.defaultPriority) finalPriority = template.defaultPriority;
        if (finalLabels.length === 0 && template.defaultLabels?.length > 0) {
          finalLabels = template.defaultLabels.map((l) => ({ name: l.name, color: l.color }));
        }
        if (finalCustomFields.length === 0 && template.defaultCustomFields?.length > 0) {
          finalCustomFields = template.defaultCustomFields.map((cf) => ({
            name: cf.name,
            type: cf.type,
            value: cf.value,
            options: cf.options,
          }));
        }
        if (finalChecklist.length === 0 && template.checklist?.length > 0) {
          finalChecklist = template.checklist.map((c) => ({
            text: c.text,
            completed: false,
          }));
        }
        if (finalEstimatedHours === null && template.estimatedHours !== null) {
          finalEstimatedHours = template.estimatedHours;
        }
      }
    }

    if (!finalTitle) {
      return res.status(400).json({ message: "Title is required" });
    }

    const existingCount = await Task.countDocuments({
      projectId,
      status: status || "todo",
    });

    const initialStatus = status || "todo";
    const initialWorkflow = await Workflow.findOne({ projectId });
    const isInitialDone = isStatusCompleted(initialStatus, initialWorkflow);
    const initialCategory = getStatusCategory(initialStatus, initialWorkflow);
    const now = new Date();

    const task = await Task.create({
      title: finalTitle,
      description: finalDescription,
      status: initialStatus,
      priority: finalPriority,
      sprintId: sprintId || null,
      milestoneId: milestoneId || null,
      parentId: parentId || null,
      dependencies: Array.isArray(dependencies) ? dependencies : [],
      labels: finalLabels,
      customFields: finalCustomFields,
      checklist: finalChecklist,
      estimatedHours: finalEstimatedHours,
      storyPoints: finalStoryPoints,
      templateId: templateId || null,
      dueDate: dueDate || null,
      assignedTo: assignedTo || [],
      projectId,
      createdBy: req.user._id,
      order: existingCount,
      startedAt: initialCategory === "in_progress" || isInitialDone ? now : null,
      completedAt: isInitialDone ? now : null,
      statusHistory: [
        {
          status: initialStatus,
          enteredAt: now,
          exitedAt: null,
          durationMs: null,
          changedBy: req.user._id,
        },
      ],
    });

    // Populate assignedTo and sprintId for immediate full response
    await task.populate("assignedTo", "name email avatar");
    await task.populate("sprintId", "name status");
    await task.populate("milestoneId", "name status dueDate");
    if (task.parentId) {
      await task.populate("parentId", "title status");
    }

    // Log activity
    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Created Task",
      message: `${req.user.name} created task "${finalTitle}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("activityCreated", {
        projectId,
        user: { name: req.user.name },
        action: "Created Task",
        message: `${req.user.name} created task "${finalTitle}"`,
        createdAt: new Date(),
      });

      io.to(`project_${projectId}`).emit("taskCreated", task);

      // Targeted notifications for assigned members
      if (Array.isArray(assignedTo)) {
        for (const assigneeId of assignedTo) {
          await createTargetedNotification(io, {
            userId: assigneeId,
            senderId: req.user._id,
            type: "TASK_ASSIGNED",
            message: `${req.user.name} assigned you to task "${finalTitle}"`,
            data: { taskId: task._id, projectId },
          });
        }
      }

      // Trigger workflow automation rules for task creation
      await runAutomationsForEvent(io, {
        event: "task_created",
        task,
        userId: req.user._id,
      });

      // Dispatch outbound webhook integration event asynchronously (INT-01)
      import("../services/integrationService.js")
        .then(({ integrationService }) => {
          integrationService.dispatchEvent({
            workspaceId: project.teamId,
            event: "task.created",
            projectId,
            payload: {
              taskId: task._id,
              title: task.title,
              status: task.status,
              priority: task.priority,
              createdBy: req.user.name,
            },
          });
        })
        .catch(() => {});
    }

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      priority,
      priorities,
      status,
      statuses,
      sprintId,
      milestoneId,
      parentId,
      label,
      labels,
      search,
      assignee,
      assignees,
      assignedTo,
      dueDateFilter,
      dependencyFilter,
      customFieldFilters,
      sortBy,
      sortOrder,
    } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view tasks in this project" });
    }

    // Parse customFieldFilters if passed as JSON string
    let parsedCustomFieldFilters = customFieldFilters;
    if (typeof customFieldFilters === "string") {
      try {
        parsedCustomFieldFilters = JSON.parse(customFieldFilters);
      } catch {
        parsedCustomFieldFilters = [];
      }
    }

    const query = buildTaskFilterQuery(
      projectId,
      {
        priority,
        priorities,
        status,
        statuses,
        sprintId,
        milestoneId,
        parentId,
        label,
        labels,
        search,
        assignee,
        assignees: assignees || assignee,
        assignedTo,
        dueDateFilter,
        dependencyFilter,
        customFieldFilters: parsedCustomFieldFilters,
      },
      req.user._id
    );

    const sortConfig = buildTaskSortConfig(sortBy, sortOrder);

    const projectWorkflow = await Workflow.findOne({ projectId });
    const tasks = await Task.find(query)
      .populate("assignedTo", "name email avatar")
      .populate("templateId", "name")
      .populate("sprintId", "name status")
      .populate("milestoneId", "name status dueDate")
      .populate("parentId", "title status")
      .populate("dependencies.taskId", "title status priority")
      .sort(sortConfig);

    // Compute subtask counts and blocker presence for each task
    const taskIds = tasks.map((t) => t._id);
    const subtasks = await Task.find({ parentId: { $in: taskIds } }).select("parentId status");

    const tasksWithDetails = tasks.map((t) => {
      const tSubtasks = subtasks.filter((st) => st.parentId?.toString() === t._id.toString());
      const totalSubtasks = tSubtasks.length;
      const completedSubtasks = tSubtasks.filter((st) => isStatusCompleted(st.status, projectWorkflow)).length;

      // Check if blocked by any incomplete task
      const hasUnresolvedBlockers = (t.dependencies || []).some(
        (d) => d.type === "blocked-by" && d.taskId && !isStatusCompleted(d.taskId.status, projectWorkflow)
      );

      return {
        ...t.toObject(),
        totalSubtasks,
        completedSubtasks,
        isBlocked: hasUnresolvedBlockers,
      };
    });

    res.json(tasksWithDetails);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const { taskId } = req.params;

    const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view this task" });
    }

    await task.populate("assignedTo", "name email avatar");
    await task.populate("templateId", "name");
    await task.populate("sprintId", "name status");
    await task.populate("milestoneId", "name status dueDate");
    await task.populate("parentId", "title status priority");
    await task.populate("dependencies.taskId", "title status priority assignedTo");
    await task.populate({
      path: "comments",
      populate: { path: "userId", select: "name email avatar" },
    });

    // Fetch direct subtasks
    const subtasks = await Task.find({ parentId: task._id })
      .populate("assignedTo", "name email avatar")
      .sort({ order: 1, createdAt: 1 });

    const { isBlocked, blockingTasks } = await checkTaskBlockers(task._id);

    const taskWorkflow = await Workflow.findOne({ projectId: task.projectId });

    res.json({
      ...task.toObject(),
      subtasks,
      totalSubtasks: subtasks.length,
      completedSubtasks: subtasks.filter((s) => isStatusCompleted(s.status, taskWorkflow)).length,
      isBlocked,
      blockingTasks,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update this task" });
    }

    // Blocker completion gate: If user is attempting to mark task as 'done',
    // verify there are no incomplete blocking tasks unless overrideBlockers flag is set
    const taskWorkflow = await Workflow.findOne({ projectId: task.projectId });
    const isTargetDone = isStatusCompleted(req.body.status, taskWorkflow);
    const isCurrentDone = isStatusCompleted(task.status, taskWorkflow);
    if (isTargetDone && !isCurrentDone && !req.body.overrideBlockers) {
      const { isBlocked, blockingTasks } = await checkTaskBlockers(taskId);
      if (isBlocked) {
        return res.status(400).json({
          message: `Cannot complete task: Blocked by ${blockingTasks.length} unresolved task(s): ${blockingTasks.map((b) => `"${b.title}"`).join(", ")}`,
          isBlocked: true,
          blockingTasks,
        });
      }
    }

    const allowed = [
      "title",
      "description",
      "status",
      "priority",
      "sprintId",
      "milestoneId",
      "parentId",
      "dueDate",
      "assignedTo",
      "labels",
      "customFields",
      "checklist",
      "estimatedHours",
      "storyPoints",
      "templateId",
      "dependencies",
    ];
    const updates = {};

    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const isStatusChanging = req.body.status && req.body.status !== task.status;
    const now = new Date();

    if (isStatusChanging) {
      const workflow = await Workflow.findOne({ projectId: task.projectId });
      const targetStatus = req.body.status;
      const targetCategory = getStatusCategory(targetStatus, workflow);
      const isTargetDone = isStatusCompleted(targetStatus, workflow);

      // Close previous open statusHistory entry if present
      const history = Array.isArray(task.statusHistory) ? [...task.statusHistory] : [];
      if (history.length > 0) {
        const lastEntry = history[history.length - 1];
        if (!lastEntry.exitedAt) {
          lastEntry.exitedAt = now;
          lastEntry.durationMs = Math.max(0, now.getTime() - new Date(lastEntry.enteredAt).getTime());
        }
      }

      // Add new status history entry
      history.push({
        status: targetStatus,
        enteredAt: now,
        exitedAt: null,
        durationMs: null,
        changedBy: req.user._id,
      });
      updates.statusHistory = history;

      // Update startedAt: if first time entering in_progress (or not set)
      if (!task.startedAt && (targetCategory === "in_progress" || isTargetDone)) {
        updates.startedAt = now;
      }

      // Update completedAt: set when moving to done; clear (reopened) when moving out of done
      if (isTargetDone) {
        updates.completedAt = now;
      } else if (task.completedAt) {
        updates.completedAt = null;
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(taskId, updates, { new: true })
      .populate("assignedTo", "name email avatar")
      .populate("templateId", "name")
      .populate("sprintId", "name status")
      .populate("milestoneId", "name status dueDate")
      .populate("parentId", "title status")
      .populate("dependencies.taskId", "title status priority");

    // Activity log
    await logActivity({
      projectId: task.projectId,
      userId: req.user._id,
      action: "Updated Task",
      message: `${req.user.name} updated task "${updatedTask.title}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${task.projectId}`).emit("activityCreated", {
        projectId: task.projectId,
        user: { name: req.user.name },
        action: "Updated Task",
        message: `${req.user.name} updated task "${updatedTask.title}"`,
        createdAt: new Date(),
      });

      io.to(`project_${task.projectId}`).emit("taskUpdated", updatedTask);

      // Trigger workflow automations for mutations
      if (req.body.status && req.body.status !== task.status) {
        await runAutomationsForEvent(io, {
          event: "status_changed",
          task: updatedTask,
          previousTask: task,
          userId: req.user._id,
        });
      }
      if (req.body.priority && req.body.priority !== task.priority) {
        await runAutomationsForEvent(io, {
          event: "priority_changed",
          task: updatedTask,
          previousTask: task,
          userId: req.user._id,
        });
      }
      if (req.body.assignedTo) {
        await runAutomationsForEvent(io, {
          event: "assignee_changed",
          task: updatedTask,
          previousTask: task,
          userId: req.user._id,
        });
      }
      if (req.body.dueDate) {
        await runAutomationsForEvent(io, {
          event: "due_date_changed",
          task: updatedTask,
          previousTask: task,
          userId: req.user._id,
        });
      }

      // Targeted notification: detect newly assigned members
      if (Array.isArray(req.body.assignedTo)) {
        const oldAssigneeSet = new Set((task.assignedTo || []).map((id) => id.toString()));
        for (const newAssigneeId of req.body.assignedTo) {
          if (!oldAssigneeSet.has(newAssigneeId.toString())) {
            await createTargetedNotification(io, {
              userId: newAssigneeId,
              senderId: req.user._id,
              type: "TASK_ASSIGNED",
              message: `${req.user.name} assigned you to task "${updatedTask.title}"`,
              data: { taskId: updatedTask._id, projectId: task.projectId },
            });
          }
        }
      }
    }

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Add a dependency relationship to a task (blocks, blocked-by, relates-to).
 * Enforces cycle detection, self-dependency rejection, and cross-project boundaries.
 */
export const addTaskDependency = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { targetTaskId, type } = req.body;

    if (!targetTaskId || !type) {
      return res.status(400).json({ message: "targetTaskId and type are required" });
    }

    if (!["blocks", "blocked-by", "relates-to"].includes(type)) {
      return res.status(400).json({ message: "Invalid dependency type" });
    }

    if (taskId.toString() === targetTaskId.toString()) {
      return res.status(400).json({ message: "Task cannot depend on itself (self-dependency)" });
    }

    const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
    if (!task) return res.status(404).json({ message: "Source task not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update this task" });
    }

    // Verify target task exists and belongs to the same project (cross-project prevention)
    const targetTask = await Task.findOne({ _id: targetTaskId, projectId: task.projectId });
    if (!targetTask) {
      return res.status(400).json({
        message: "Target task not found or belongs to a different project (cross-project isolation)",
      });
    }

    // Check if dependency already exists
    const alreadyExists = (task.dependencies || []).some(
      (d) => d.taskId?.toString() === targetTaskId.toString() && d.type === type
    );
    if (alreadyExists) {
      return res.status(400).json({ message: "Dependency relationship already exists" });
    }

    // Circular dependency detection
    const { hasCycle } = await detectCircularDependency(taskId, targetTaskId, type);
    if (hasCycle) {
      return res.status(400).json({
        message: "Circular dependency detected: Adding this relationship creates a blocking cycle",
      });
    }

    task.dependencies.push({ taskId: targetTaskId, type });
    await task.save();

    await task.populate("dependencies.taskId", "title status priority");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${task.projectId}`).emit("taskUpdated", task);
    }

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Remove a dependency relationship from a task.
 */
export const removeTaskDependency = async (req, res) => {
  try {
    const { taskId, dependencyTaskId } = req.params;

    const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update this task" });
    }

    task.dependencies = (task.dependencies || []).filter(
      (d) => d.taskId?.toString() !== dependencyTaskId.toString()
    );
    await task.save();

    await task.populate("dependencies.taskId", "title status priority");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${task.projectId}`).emit("taskUpdated", task);
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to delete this task" });
    }

    const projectId = task.projectId;

    // Delete task and clean up references
    await Task.findByIdAndDelete(taskId);

    // If task was a parent, orphan subtasks by unsetting parentId
    await Task.updateMany({ parentId: taskId }, { $set: { parentId: null } });

    // Clean up dependency references from other tasks
    await Task.updateMany(
      { "dependencies.taskId": taskId },
      { $pull: { dependencies: { taskId } } }
    );

    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Deleted Task",
      message: `${req.user.name} deleted a task`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("activityCreated", {
        projectId,
        user: { name: req.user.name },
        action: "Deleted Task",
        message: `${req.user.name} deleted a task`,
        createdAt: new Date(),
      });

      io.to(`project_${projectId}`).emit("taskDeleted", { _id: taskId });
    }

    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const moveTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, order, overrideBlockers } = req.body;

    const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to move this task" });
    }

    // Blocker gate: if moving to 'done', check active blockers
    const moveWorkflow = await Workflow.findOne({ projectId: task.projectId });
    const isMoveTargetDone = isStatusCompleted(status, moveWorkflow);
    const isMoveCurrentDone = isStatusCompleted(task.status, moveWorkflow);
    if (isMoveTargetDone && !isMoveCurrentDone && !overrideBlockers) {
      const { isBlocked, blockingTasks } = await checkTaskBlockers(taskId);
      if (isBlocked) {
        return res.status(400).json({
          message: `Cannot move to Done: Task is blocked by ${blockingTasks.length} unresolved task(s): ${blockingTasks.map((b) => `"${b.title}"`).join(", ")}`,
          isBlocked: true,
          blockingTasks,
        });
      }
    }

    const previousStatus = task.status;
    const now = new Date();

    if (previousStatus !== status) {
      const targetCategory = getStatusCategory(status, moveWorkflow);

      // Close previous open statusHistory entry if present
      if (!Array.isArray(task.statusHistory)) {
        task.statusHistory = [];
      }
      if (task.statusHistory.length > 0) {
        const lastEntry = task.statusHistory[task.statusHistory.length - 1];
        if (!lastEntry.exitedAt) {
          lastEntry.exitedAt = now;
          lastEntry.durationMs = Math.max(0, now.getTime() - new Date(lastEntry.enteredAt).getTime());
        }
      }

      task.statusHistory.push({
        status,
        enteredAt: now,
        exitedAt: null,
        durationMs: null,
        changedBy: req.user._id,
      });

      // Update startedAt
      if (!task.startedAt && (targetCategory === "in_progress" || isMoveTargetDone)) {
        task.startedAt = now;
      }

      // Update completedAt: set when moving to done; clear when reopened from done
      if (isMoveTargetDone) {
        task.completedAt = now;
      } else if (task.completedAt) {
        task.completedAt = null;
      }
    }

    task.status = status;
    task.order = order;
    await task.save();

    await logActivity({
      projectId: task.projectId,
      userId: req.user._id,
      action: "Moved Task",
      message: `${req.user.name} moved "${task.title}" to ${status}`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${task.projectId}`).emit("activityCreated", {
        projectId: task.projectId,
        user: { name: req.user.name },
        action: "Moved Task",
        message: `${req.user.name} moved "${task.title}" to ${status}`,
        createdAt: new Date(),
      });

      io.to(`project_${task.projectId}`).emit("taskMoved", task);

      if (previousStatus !== status) {
        await runAutomationsForEvent(io, {
          event: "status_changed",
          task,
          previousTask: { ...task.toObject(), status: previousStatus },
          userId: req.user._id,
        });
      }
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Bulk updates tasks (sprint assignment, status change, or priority update).
 */
export const bulkUpdateTasks = async (req, res) => {
  try {
    const { taskIds, updates, projectId } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: "taskIds must be a non-empty array" });
    }

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const { hasAccess } = await checkProjectAccess(projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update tasks in this project" });
    }

    const allowedUpdates = {};
    if (updates.sprintId !== undefined) {
      allowedUpdates.sprintId = updates.sprintId === "backlog" || !updates.sprintId ? null : updates.sprintId;
    }
    if (updates.milestoneId !== undefined) {
      allowedUpdates.milestoneId = updates.milestoneId === "none" || !updates.milestoneId ? null : updates.milestoneId;
    }
    if (updates.status && typeof updates.status === "string") {
      allowedUpdates.status = updates.status;
    }
    if (updates.priority && ["low", "medium", "high", "critical", "urgent"].includes(updates.priority)) {
      allowedUpdates.priority = updates.priority;
    }

    const result = await Task.updateMany(
      { _id: { $in: taskIds }, projectId },
      { $set: allowedUpdates }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("tasksBatchUpdated", {
        taskIds,
        updates: allowedUpdates,
      });
    }

    res.json({
      message: "Bulk update successful",
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Reorders tasks in the backlog or a sprint for rank prioritization.
 */
export const reorderTasks = async (req, res) => {
  try {
    const { taskOrderList, projectId } = req.body;

    if (!Array.isArray(taskOrderList) || taskOrderList.length === 0) {
      return res.status(400).json({ message: "taskOrderList must be an array" });
    }

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const { hasAccess } = await checkProjectAccess(projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to reorder tasks in this project" });
    }

    const bulkOps = taskOrderList.map(({ taskId, order }) => ({
      updateOne: {
        filter: { _id: taskId, projectId },
        update: { $set: { order: Number(order) || 0 } },
      },
    }));

    await Task.bulkWrite(bulkOps);

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("tasksReordered", {
        taskOrderList,
      });
    }

    res.json({ message: "Tasks reordered successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

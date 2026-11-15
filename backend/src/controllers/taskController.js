import Task from "../models/Task.js";
import TaskTemplate from "../models/TaskTemplate.js";
import Sprint from "../models/Sprint.js";
import { Project } from "../models/Project.js";
import { logActivity } from "./activityController.js";
import { checkProjectAccess, checkTaskAccess } from "../utils/authHelpers.js";
import { createTargetedNotification } from "../utils/notificationHelpers.js";

export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      projectId,
      priority,
      sprintId,
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

    let finalTitle = title ? title.trim() : "";
    let finalDescription = description || "";
    let finalPriority = priority || "medium";
    let finalLabels = Array.isArray(labels) ? labels : [];
    let finalCustomFields = Array.isArray(customFields) ? customFields : [];
    let finalChecklist = Array.isArray(checklist) ? checklist : [];
    let finalEstimatedHours = estimatedHours !== undefined ? estimatedHours : null;

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

    const task = await Task.create({
      title: finalTitle,
      description: finalDescription,
      status: status || "todo",
      priority: finalPriority,
      sprintId: sprintId || null,
      labels: finalLabels,
      customFields: finalCustomFields,
      checklist: finalChecklist,
      estimatedHours: finalEstimatedHours,
      templateId: templateId || null,
      dueDate: dueDate || null,
      assignedTo: assignedTo || [],
      projectId,
      createdBy: req.user._id,
      order: existingCount,
    });

    // Populate assignedTo and sprintId for immediate full response
    await task.populate("assignedTo", "name email avatar");
    await task.populate("sprintId", "name status");

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
    }

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { priority, status, sprintId, label, search, sortBy, sortOrder } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view tasks in this project" });
    }

    const query = { projectId };

    if (priority) {
      query.priority = priority;
    }

    if (status) {
      query.status = status;
    }

    if (sprintId !== undefined) {
      if (sprintId === "backlog" || sprintId === "null" || sprintId === "") {
        query.sprintId = null;
      } else if (sprintId !== "all") {
        query.sprintId = sprintId;
      }
    }

    if (label) {
      query["labels.name"] = { $regex: new RegExp(`^${label.trim()}$`, "i") };
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ title: regex }, { description: regex }];
    }

    let sort = { status: 1, order: 1, createdAt: 1 };
    if (sortBy) {
      const order = sortOrder === "desc" ? -1 : 1;
      sort = { [sortBy]: order };
    }

    const tasks = await Task.find(query)
      .populate("assignedTo", "name email avatar")
      .populate("templateId", "name")
      .populate("sprintId", "name status")
      .sort(sort);

    res.json(tasks);
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
    await task.populate({
      path: "comments",
      populate: { path: "userId", select: "name email avatar" },
    });

    res.json(task);
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

    const allowed = [
      "title",
      "description",
      "status",
      "priority",
      "sprintId",
      "dueDate",
      "assignedTo",
      "labels",
      "customFields",
      "checklist",
      "estimatedHours",
      "templateId",
    ];
    const updates = {};

    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const updatedTask = await Task.findByIdAndUpdate(taskId, updates, { new: true })
      .populate("assignedTo", "name email avatar")
      .populate("templateId", "name")
      .populate("sprintId", "name status");

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

    await Task.findByIdAndDelete(taskId);

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
    const { status, order } = req.body;

    const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to move this task" });
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
    if (updates.status && ["todo", "in-progress", "review", "done"].includes(updates.status)) {
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
    const { taskOrderList, projectId } = req.body; // array of { taskId, order }

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

    // Execute bulk write operations
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

// backend/src/controllers/taskController.js
import  Task  from "../models/Task.js";
import { Project } from "../models/Project.js";
import Activity  from "../models/Activity.js"; // ensure model exists
import mongoose from "mongoose";

/* Create task */
export const createTask = async (req, res) => {
  try {
    const { title, description, status, projectId } = req.body;

    if (!title || !projectId) {
      return res.status(400).json({ message: "Title and projectId are required" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const existingCount = await Task.countDocuments({
      projectId,
      status: status || "todo",
    });

    const task = await Task.create({
      title,
      description: description || "",
      status: status || "todo",
      projectId,
      createdBy: req.user._id,
      order: existingCount,
    });

    // Create a lightweight activity entry (optional)
    try {
      const activity = await Activity.create({
        projectId,
        taskId: task._id,
        user: req.user._id,
        action: "TASK_CREATED",
        message: `${req.user.name} created task "${task.title}"`,
      });

      // Emit activity to project room
      const io = req.app.get("io");
      if (io) {
        io.to(`project_${projectId}`).emit("activityCreated", activity);
      }
    } catch (actErr) {
      console.warn("Activity create error:", actErr);
    }

    // Emit the new task to project room
    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("taskCreated", task);
    }

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Get all tasks for a project, grouped by status and ordered */
export const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await Task.find({ projectId })
      .sort({ status: 1, order: 1, createdAt: 1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Update task (edit modal) */
export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, status } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const oldStatus = task.status;

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;

    await task.save();

    // Activity create + emit
    try {
      const activity = await Activity.create({
        projectId: task.projectId,
        taskId: task._id,
        user: req.user._id,
        action: "TASK_UPDATED",
        message: `${req.user.name} updated task "${task.title}"`,
      });

      const io = req.app.get("io");
      if (io) io.to(`project_${task.projectId}`).emit("activityCreated", activity);
    } catch (actErr) {
      console.warn("Activity create error:", actErr);
    }

    // Emit update
    const io = req.app.get("io");
    if (io) io.to(`project_${task.projectId}`).emit("taskUpdated", task);

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Delete task */
export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const projectId = task.projectId;
    await Task.findByIdAndDelete(taskId);

    // Activity + emit
    try {
      const activity = await Activity.create({
        projectId,
        taskId,
        user: req.user._id,
        action: "TASK_DELETED",
        message: `${req.user.name} deleted task "${task.title}"`,
      });
      const io = req.app.get("io");
      if (io) io.to(`project_${projectId}`).emit("activityCreated", activity);
    } catch (actErr) {
      console.warn("Activity create error:", actErr);
    }

    const io = req.app.get("io");
    if (io) io.to(`project_${projectId}`).emit("taskDeleted", { _id: taskId });

    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Update task order + status after drag & drop */
export const moveTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, order } = req.body; // new status + order

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const oldStatus = task.status;
    task.status = status;
    task.order = order;
    await task.save();

    // Activity + emit
    try {
      const activity = await Activity.create({
        projectId: task.projectId,
        taskId: task._id,
        user: req.user._id,
        action: "TASK_MOVED",
        message: `${req.user.name} moved task "${task.title}" from ${oldStatus} → ${status}`,
      });
      const io = req.app.get("io");
      if (io) io.to(`project_${task.projectId}`).emit("activityCreated", activity);
    } catch (actErr) {
      console.warn("Activity create error:", actErr);
    }

    // Emit move so frontends can reorder locally
    const io = req.app.get("io");
    if (io) io.to(`project_${task.projectId}`).emit("taskMoved", task);

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

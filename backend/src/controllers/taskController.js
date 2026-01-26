import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { logActivity } from "./activityController.js";

export const createTask = async (req, res) => {
  try {
    const { title, description, status, projectId, priority, dueDate, assignedTo } = req.body;

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
      priority: priority || "medium",
      dueDate: dueDate || null,
      assignedTo: assignedTo || [],
      projectId,
      createdBy: req.user._id,
      order: existingCount,
    });

    // Log activity
    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Created Task",
      message: `${req.user.name} created task "${title}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("activityCreated", {
        projectId,
        user: { name: req.user.name },
        action: "Created Task",
        message: `${req.user.name} created task "${title}"`,
        createdAt: new Date(),
      });

      io.to(`project_${projectId}`).emit("taskCreated", task);
    }

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const tasks = await Task.find({ projectId })
      .populate("assignedTo", "name email avatar")
      .sort({ status: 1, order: 1, createdAt: 1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const allowed = ["title", "description", "status", "priority", "dueDate", "assignedTo"];
    const updates = {};

    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const task = await Task.findByIdAndUpdate(taskId, updates, { new: true })
      .populate("assignedTo", "name email avatar");

    if (!task) return res.status(404).json({ message: "Task not found" });

    // Activity log
    await logActivity({
      projectId: task.projectId,
      userId: req.user._id,
      action: "Updated Task",
      message: `${req.user.name} updated task "${task.title}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${task.projectId}`).emit("activityCreated", {
        projectId: task.projectId,
        user: { name: req.user.name },
        action: "Updated Task",
        message: `${req.user.name} updated task "${task.title}"`,
        createdAt: new Date(),
      });

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

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

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

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

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

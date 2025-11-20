// backend/src/controllers/taskController.js
import { Task } from "../models/Task.js";
import { Project } from "../models/Project.js";

/* Create task */
export const createTask = async (req, res) => {
  try {
    const { title, description, status, projectId, assignedTo } = req.body;

    if (!title || !projectId) {
      return res
        .status(400)
        .json({ message: "Title and projectId are required" });
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
      // ✅ multiple assignees (array of userIds)
      assignedTo: Array.isArray(assignedTo) ? assignedTo : [],
    });

    const populated = await Task.findById(task._id).populate(
      "assignedTo",
      "name email"
    );

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Get all tasks for a project */
export const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await Task.find({ projectId })
      .sort({
        status: 1,
        order: 1,
        createdAt: 1,
      })
      .populate("assignedTo", "name email");

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Update task (edit, including assignedTo) */
export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, status, assignedTo } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;

    if (assignedTo !== undefined) {
      task.assignedTo = Array.isArray(assignedTo) ? assignedTo : [];
    }

    await task.save();

    const populated = await Task.findById(task._id).populate(
      "assignedTo",
      "name email"
    );

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Delete task */
export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    await Task.findByIdAndDelete(taskId);
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Move task (change status + order) */
export const moveTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, order } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.status = status;
    task.order = order;
    await task.save();

    const populated = await Task.findById(task._id).populate(
      "assignedTo",
      "name email"
    );

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

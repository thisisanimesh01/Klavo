import { Task } from "../models/Task.js";
import { Project } from "../models/Project.js";
import { User } from "../models/User.js";

/* ------------------------ Create Task ------------------------ */
export const createTask = async (req, res) => {
  try {
    const { title, description, projectId, assignee, priority, dueDate } = req.body;

    if (!title || !projectId) {
      return res.status(400).json({ message: "Title and Project ID required" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const task = await Task.create({
      title,
      description,
      projectId,
      assignee: assignee || null,
      priority: priority || "medium",
      dueDate: dueDate || null,
    });

    res.status(201).json({ message: "Task created", task });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ------------------------ Get Tasks by Project ------------------------ */
export const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const tasks = await Task.find({ projectId })
      .populate("assignee", "name email")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ------------------------ Get Single Task ------------------------ */
export const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findById(id)
      .populate("assignee", "name email")
      .populate({
        path: "comments.userId",
        select: "name email",
      });

    if (!task) return res.status(404).json({ message: "Task not found" });

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ------------------------ Update Task ------------------------ */
export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, assignee, priority, dueDate } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    if (status) task.status = status;
    if (dueDate !== undefined) task.dueDate = dueDate || null;

    if (assignee === "" || assignee === null) {
      task.assignee = null;
    } else if (assignee) {
      const user = await User.findById(assignee);
      if (!user) return res.status(404).json({ message: "Assignee not found" });
      task.assignee = assignee;
    }

    await task.save();

    const io = req.app.get("io");
    io?.emit("task-updated", { taskId: task._id, status: task.status, projectId: task.projectId });

    res.json({ message: "Task updated", task });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ------------------------ Add Comment ------------------------ */
export const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text) return res.status(400).json({ message: "Comment cannot be empty" });

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.comments.push({ userId: req.user._id, text });
    await task.save();

    await task.populate({
      path: "comments.userId",
      select: "name email",
    });

    const io = req.app.get("io");
    io?.emit("task-commented", { taskId: task._id, projectId: task.projectId });

    res.json({ message: "Comment added", task });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ------------------------ Move Task (Drag & Drop) ------------------------ */
export const moveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Not found" });

    task.status = status;
    await task.save();

    const io = req.app.get("io");
    io?.emit("task-updated", { taskId: task._id, status, projectId: task.projectId });

    res.json({ message: "Status updated", task });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

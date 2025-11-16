import { Task } from "../models/Task.js";
import { Project } from "../models/Project.js";
import { User } from "../models/User.js";

// Create a new task
export const createTask = async (req, res) => {
  try {
    const { title, description, projectId, assignee, priority, dueDate } = req.body;
    const userId = req.user._id;

    if (!title || !projectId) {
      return res.status(400).json({ message: "Title and Project ID are required" });
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Optionally check if user is part of team here if needed

    const task = await Task.create({
      title,
      description,
      projectId,
      assignee: assignee || null,
      priority: priority || "medium",
      dueDate: dueDate || null,
    });

    res.status(201).json({ message: "Task created", task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all tasks for a project
export const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;

    // Optionally check if user has access to project

    const tasks = await Task.find({ projectId })
      .populate("assignee", "name email profileImage")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update task info (title, description, status, assignee, priority, dueDate)
export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, assignee, priority, dueDate } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (title) task.title = title;
    if (description) task.description = description;
    if (status && ["todo", "in-progress", "review", "done"].includes(status)) {
      task.status = status;
    }
    if (assignee) {
      const user = await User.findById(assignee);
      if (!user) return res.status(404).json({ message: "Assignee user not found" });
      task.assignee = user._id;
    }
    if (priority && ["low", "medium", "high"].includes(priority)) {
      task.priority = priority;
    }
    if (dueDate) task.dueDate = dueDate;

    await task.save();

    res.json({ message: "Task updated", task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a comment to a task
export const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text) return res.status(400).json({ message: "Comment text is required" });

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.comments.push({ userId, text });
    await task.save();

    res.json({ message: "Comment added", task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Move task to a new status (for Kanban drag & drop)
export const moveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["todo", "in-progress", "review", "done"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.status = status;
    await task.save();

    res.json({ message: "Task status updated", task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

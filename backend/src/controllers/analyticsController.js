import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";
import { checkProjectAccess } from "../utils/authHelpers.js";

// Get analytics for a specific project
export const getProjectAnalytics = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view analytics for this project" });
    }

    const tasks = await Task.find({ projectId });
    const taskCount = tasks.length;
    const completedCount = tasks.filter((t) => t.status === "done").length;
    const inProgressCount = tasks.filter((t) => t.status === "in-progress").length;
    const todoCount = tasks.filter((t) => t.status === "todo").length;
    const reviewCount = tasks.filter((t) => t.status === "review").length;

    // Status breakdown
    const statusDistribution = [
      { _id: "todo", count: todoCount },
      { _id: "in-progress", count: inProgressCount },
      { _id: "review", count: reviewCount },
      { _id: "done", count: completedCount },
    ];

    // Priority breakdown
    const priorityDistribution = [
      { _id: "low", count: tasks.filter((t) => t.priority === "low").length },
      { _id: "medium", count: tasks.filter((t) => t.priority === "medium").length },
      { _id: "high", count: tasks.filter((t) => t.priority === "high").length },
      { _id: "critical", count: tasks.filter((t) => t.priority === "critical").length },
    ];

    res.json({
      projectId,
      projectName: project.name,
      taskCount,
      completedCount,
      completionRate: taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0,
      statusDistribution,
      priorityDistribution,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

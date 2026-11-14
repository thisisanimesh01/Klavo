import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";

export const getCalendarTasks = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all teams where user is an owner or member
    const teams = await Team.find({
      $or: [{ members: userId }, { owner: userId }],
    }).select("_id");
    const teamIds = teams.map((t) => t._id);

    // Find all projects in those teams
    const userProjects = await Project.find({ teamId: { $in: teamIds } }).select("_id name");
    const projectIds = userProjects.map((p) => p._id);

    // Find user's tasks with due dates in accessible projects
    const tasks = await Task.find({
      assignedTo: userId,
      projectId: { $in: projectIds },
      dueDate: { $ne: null },
    })
      .populate("projectId", "name")
      .populate("assignedTo", "name email avatar")
      .sort({ dueDate: 1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

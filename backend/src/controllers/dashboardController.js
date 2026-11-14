import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";

export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // get teams of the user (as member or owner)
    const teams = await Team.find({
      $or: [{ members: userId }, { owner: userId }],
    }).select("_id");
    const teamIds = teams.map((t) => t._id);

    // get projects in those teams
    const userProjects = await Project.find({ teamId: { $in: teamIds } }).select("_id");
    const projectIds = userProjects.map((p) => p._id);
    const projectCount = userProjects.length;

    // team count
    const teamCount = teams.length;

    // get tasks in those authorized projects
    const tasks = await Task.find({ projectId: { $in: projectIds } });

    const taskCount = tasks.length;
    const completedCount = tasks.filter((t) => t.status === "done").length;

    // weekly activity - tasks created per day in last week
    const weeklyActivity = await Task.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // status distribution
    const statusDistribution = await Task.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // respond with stats
    res.json({
      projectCount,
      teamCount,
      taskCount,
      completedCount,
      weeklyActivity,
      statusDistribution,
    });
  } catch (err) {
    console.error("Dashboard Stats Error :", err);
    res.status(500).json({ message: err.message });
  }
};

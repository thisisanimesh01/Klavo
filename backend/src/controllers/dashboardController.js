import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";
import Activity from "../models/Activity.js";

export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get teams of the user (as member or owner)
    const teams = await Team.find({
      $or: [{ members: userId }, { owner: userId }],
    }).select("_id");
    const teamIds = teams.map((t) => t._id);

    // Get projects in those teams
    const userProjects = await Project.find({ teamId: { $in: teamIds } }).select("_id");
    const projectIds = userProjects.map((p) => p._id);
    const projectCount = userProjects.length;

    // Team count
    const teamCount = teams.length;

    // Get tasks in those authorized projects
    const tasks = await Task.find({ projectId: { $in: projectIds } });

    const taskCount = tasks.length;
    const completedCount = tasks.filter((t) => t.status === "done").length;

    // Weekly activity - normalize to all 7 days of the week (Sun=1..Sat=7)
    // with friendly day labels so charts always render 7 consecutive days cleanly
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyAgg = await Task.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          count: { $sum: 1 },
        },
      },
    ]);

    const weeklyMap = new Map();
    weeklyAgg.forEach((w) => {
      weeklyMap.set(w._id, w.count);
    });

    // Generate 7-day structure [1=Sun, 2=Mon, ..., 7=Sat]
    const weeklyActivity = [];
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      weeklyActivity.push({
        _id: dayNames[dayNum - 1],
        dayOfWeek: dayNum,
        count: weeklyMap.get(dayNum) || 0,
      });
    }

    // Status distribution
    const statusAgg = await Task.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusMap = new Map();
    statusAgg.forEach((s) => {
      statusMap.set(s._id, s.count);
    });

    const standardStatuses = ["todo", "in-progress", "done"];
    const statusDistribution = standardStatuses.map((st) => ({
      _id: st,
      count: statusMap.get(st) || 0,
    }));

    // Recent activity across all authorized projects (latest 10)
    const recentActivity = await Activity.find({ projectId: { $in: projectIds } })
      .populate("user", "name email")
      .populate("projectId", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      projectCount,
      teamCount,
      taskCount,
      completedCount,
      weeklyActivity,
      statusDistribution,
      recentActivity,
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ message: err.message });
  }
};

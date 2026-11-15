import Activity from "../models/Activity.js";
import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";
import { checkProjectAccess } from "../utils/authHelpers.js";

export const logActivity = async ({ projectId, userId, action, message }) => {
  return await Activity.create({
    projectId,
    user: userId,
    action,
    message,
  });
};

export const getProjectActivity = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must be a member of the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view activity for this project" });
    }

    const logs = await Activity.find({ projectId })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyActivity = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all teams where user is owner or member
    const teams = await Team.find({
      $or: [{ members: userId }, { owner: userId }],
    }).select("_id");
    const teamIds = teams.map((t) => t._id);

    // Get all projects belonging to those teams
    const userProjects = await Project.find({ teamId: { $in: teamIds } }).select("_id");
    const projectIds = userProjects.map((p) => p._id);

    const logs = await Activity.find({ projectId: { $in: projectIds } })
      .populate("user", "name email")
      .populate("projectId", "name")
      .sort({ createdAt: -1 })
      .limit(30);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

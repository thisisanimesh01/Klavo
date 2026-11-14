import Activity from "../models/Activity.js";
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

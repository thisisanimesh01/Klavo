import Activity from "../models/Activity.js";

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

    const logs = await Activity.find({ projectId })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// backend/src/controllers/activityController.js
import { Activity } from "../models/Activity.js";

export const getProjectActivity = async (req, res) => {
  try {
    const { projectId } = req.params;

    const logs = await Activity.find({ projectId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("user", "name email");

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

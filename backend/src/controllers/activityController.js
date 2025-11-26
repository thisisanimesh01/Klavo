// backend/src/controllers/activityController.js
import Activity  from "../models/Activity.js";

export const getProjectActivity = async (req, res) => {
  try {
    const { projectId } = req.params;

    const activities = await Activity.find({ projectId })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (err) {
    console.error("Activity fetch error:", err.message);
    res.status(500).json({ message: "Failed to load activity" });
  }
};

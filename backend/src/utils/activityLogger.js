import Activity from "../models/Activity.js";

export const logActivity = async ({
  userId,
  action,
  message,
  projectId,
  taskId = null,
  io = null,
}) => {
  try {
    const activity = await Activity.create({
      user: userId,
      action,
      message,
      projectId,
      taskId,
    });

    if (io && projectId) {
      const populated = await Activity.findById(activity._id).populate("user", "name email avatar");
      io.to(`project_${projectId}`).emit("activityCreated", populated);
    }

    return activity;
  } catch (err) {
    console.error("Failed to log activity:", err.message);
  }
};

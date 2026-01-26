import { Activity } from "../models/Activity.js";

export const logActivity = async ({
  userId,
  action,
  message,
  projectId,
  taskId = null,
}) => {
  try {
    await Activity.create({
      user: userId,
      action,
      message,
      projectId,
      taskId,
    });
  } catch (err) {
    console.error("Failed to log activity:", err.message);
  }
};

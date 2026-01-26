import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true }, // TASK_UPDATED, MESSAGE, COMMENT, etc
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    data: { type: Object }, // Additional data related to the notification
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;

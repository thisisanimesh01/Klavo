import mongoose from "mongoose";

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    categories: {
      assignments: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      reactions: { type: Boolean, default: true },
      taskUpdates: { type: Boolean, default: true },
      projectActivity: { type: Boolean, default: true },
      workspaceEvents: { type: Boolean, default: true },
    },
    channels: {
      inApp: { type: Boolean, default: true },
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: "22:00" }, // "HH:mm" in 24hr format
      end: { type: String, default: "08:00" },   // "HH:mm" in 24hr format
      timezone: { type: String, default: "UTC" },
    },
    grouping: {
      enabled: { type: Boolean, default: true },
      windowMinutes: { type: Number, default: 5, min: 1, max: 60 },
    },
  },
  { timestamps: true }
);

export const NotificationPreference = mongoose.model(
  "NotificationPreference",
  notificationPreferenceSchema
);
export default NotificationPreference;

import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: { type: String, required: true }, // Created Task, Updated Task, Deleted Task, Moved Task, Uploaded File
    message: { type: String, required: true },
  },
  { timestamps: true }
);

activitySchema.index({ projectId: 1, createdAt: -1 });
activitySchema.index({ user: 1 });

export default mongoose.model("Activity", activitySchema);

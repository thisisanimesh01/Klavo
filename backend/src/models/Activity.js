
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
    action: { type: String, required: true }, // Created Task, Updated Task, Deleted Task, Moved Task
    message: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Activity", activitySchema);

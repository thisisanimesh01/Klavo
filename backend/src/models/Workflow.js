import mongoose from "mongoose";

const statusItemSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      default: "#6366f1",
      trim: true,
    },
    category: {
      type: String,
      enum: ["todo", "in_progress", "review", "done"],
      required: true,
      default: "todo",
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: "Default Workflow",
      trim: true,
    },
    description: {
      type: String,
      default: "Standard project lifecycle workflow",
      trim: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true, // One active workflow per project
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    statuses: {
      type: [statusItemSchema],
      default: [
        { key: "todo", name: "Todo", color: "#94a3b8", category: "todo", order: 0 },
        { key: "in-progress", name: "In Progress", color: "#3b82f6", category: "in_progress", order: 1 },
        { key: "review", name: "In Review", color: "#f59e0b", category: "review", order: 2 },
        { key: "done", name: "Done", color: "#10b981", category: "done", order: 3 },
      ],
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

workflowSchema.index({ teamId: 1 });

export default mongoose.model("Workflow", workflowSchema);

import mongoose from "mongoose";

const integrationActivitySchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
    },
    provider: {
      type: String,
      enum: ["github", "slack", "webhook", "api"],
      required: true,
      index: true,
    },
    // Type of activity: "commit" | "pull_request" | "issue" | "deployment" | "slack_message"
    activityType: {
      type: String,
      required: true,
    },
    // External ID (e.g. PR #123, commit hash)
    externalId: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

integrationActivitySchema.index({ projectId: 1, createdAt: -1 });
integrationActivitySchema.index({ taskId: 1, createdAt: -1 });

export default mongoose.model("IntegrationActivity", integrationActivitySchema);

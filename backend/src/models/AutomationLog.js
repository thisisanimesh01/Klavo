import mongoose from "mongoose";

const automationLogSchema = new mongoose.Schema(
  {
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AutomationRule",
      required: true,
    },
    ruleName: {
      type: String,
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    taskTitle: {
      type: String,
      default: "",
    },
    triggerEvent: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["success", "failed", "skipped"],
      required: true,
    },
    actionsExecuted: [
      {
        type: { type: String },
        payload: { type: mongoose.Schema.Types.Mixed },
        status: { type: String, enum: ["applied", "failed", "skipped"] },
        error: { type: String },
      },
    ],
    reason: {
      type: String,
      default: "",
    },
    depth: {
      type: Number,
      default: 0,
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

automationLogSchema.index({ projectId: 1, executedAt: -1 });
automationLogSchema.index({ ruleId: 1, executedAt: -1 });
automationLogSchema.index({ taskId: 1, executedAt: -1 });

export default mongoose.model("AutomationLog", automationLogSchema);

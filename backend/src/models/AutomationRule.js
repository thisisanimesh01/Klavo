import mongoose from "mongoose";

const conditionSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      enum: ["status", "priority", "assignedTo", "labels", "milestoneId", "sprintId", "dueDate"],
    },
    operator: {
      type: String,
      required: true,
      enum: ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty", "contains"],
      default: "equals",
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "set_status",
        "set_priority",
        "assign_user",
        "add_assignee",
        "remove_assignee",
        "add_label",
        "send_notification",
        "set_due_date_relative", // e.g. +3 days
      ],
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false }
);

const automationRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    trigger: {
      event: {
        type: String,
        required: true,
        enum: [
          "task_created",
          "status_changed",
          "priority_changed",
          "assignee_changed",
          "due_date_changed",
        ],
      },
      // Optional trigger specific constraints (e.g. fromStatus -> toStatus)
      fromValue: { type: mongoose.Schema.Types.Mixed },
      toValue: { type: mongoose.Schema.Types.Mixed },
    },
    conditions: {
      type: [conditionSchema],
      default: [],
    },
    actions: {
      type: [actionSchema],
      required: true,
      validate: [
        (val) => Array.isArray(val) && val.length > 0,
        "Automation rule must have at least one action",
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    executionCount: {
      type: Number,
      default: 0,
    },
    lastExecutedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

automationRuleSchema.index({ projectId: 1, isActive: 1 });
automationRuleSchema.index({ projectId: 1, "trigger.event": 1 });

export default mongoose.model("AutomationRule", automationRuleSchema);

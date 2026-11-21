import mongoose from "mongoose";

const conditionSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      enum: ["status", "priority", "assignedTo", "labels", "milestoneId", "sprintId", "dueDate", "title"],
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
        "set_due_date_relative",
        "dispatch_webhook",
        "create_task",
        "send_slack_alert",
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
          "scheduled_tick", // Cron / Scheduled trigger
        ],
      },
      // Optional trigger specific constraints (e.g. fromStatus -> toStatus)
      fromValue: { type: mongoose.Schema.Types.Mixed },
      toValue: { type: mongoose.Schema.Types.Mixed },
      scheduleConfig: {
        frequency: {
          type: String,
          enum: ["hourly", "daily", "weekly"],
          default: "daily",
        },
        time: { type: String, default: "09:00" },
      },
    },
    // Logical condition grouping: 'AND' (all match) or 'OR' (any match)
    conditionMatchMode: {
      type: String,
      enum: ["AND", "OR"],
      default: "AND",
    },
    conditions: {
      type: [conditionSchema],
      default: [],
    },
    // Primary actions (when conditions pass)
    actions: {
      type: [actionSchema],
      required: true,
      validate: [
        (val) => Array.isArray(val) && val.length > 0,
        "Automation rule must have at least one action",
      ],
    },
    // Optional else actions (when conditions fail - branching)
    elseActions: {
      type: [actionSchema],
      default: [],
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
    // Optional approval requirement for sensitive actions
    requiresApproval: {
      type: Boolean,
      default: false,
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
automationRuleSchema.index({ "trigger.event": 1, isActive: 1 });

export default mongoose.model("AutomationRule", automationRuleSchema);

import mongoose from "mongoose";

const reportFilterSchema = new mongoose.Schema(
  {
    range: {
      type: String,
      enum: ["all", "today", "this_week", "this_month", "last_30_days", "custom"],
      default: "all",
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    dateField: {
      type: String,
      enum: ["createdAt", "dueDate", "completedAt", "updatedAt"],
      default: "createdAt",
    },
    statuses: [{ type: String, trim: true }],
    priorities: [{ type: String, trim: true }],
    assignees: [{ type: String, trim: true }], // User IDs or "unassigned"
    sprintId: { type: String, default: "all", trim: true }, // "all", "backlog", or ObjectId
    milestoneId: { type: String, default: "all", trim: true }, // "all", "none", or ObjectId
  },
  { _id: false }
);

const savedReportSchema = new mongoose.Schema(
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
      required: false,
    },
    projectIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    }],
    scope: {
      type: String,
      enum: ["project", "workspace"],
      default: "project",
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    reportType: {
      type: String,
      enum: ["task_summary", "throughput", "workload", "milestones", "custom"],
      default: "task_summary",
    },
    groupBy: {
      type: String,
      enum: ["none", "status", "priority", "assignee", "sprint", "milestone", "project"],
      default: "status",
    },
    sortBy: {
      type: String,
      enum: ["createdAt", "dueDate", "completedAt", "priority", "title", "estimatedHours"],
      default: "createdAt",
    },
    sortOrder: {
      type: String,
      enum: ["asc", "desc"],
      default: "desc",
    },
    filters: {
      type: reportFilterSchema,
      default: () => ({}),
    },
    chartType: {
      type: String,
      enum: ["bar", "pie", "area", "table"],
      default: "bar",
    },
  },
  { timestamps: true }
);

savedReportSchema.index({ projectId: 1, isShared: 1 });
savedReportSchema.index({ projectId: 1, createdBy: 1 });
savedReportSchema.index({ teamId: 1, scope: 1, isShared: 1 });
savedReportSchema.index({ teamId: 1, scope: 1, createdBy: 1 });

export default mongoose.model("SavedReport", savedReportSchema);

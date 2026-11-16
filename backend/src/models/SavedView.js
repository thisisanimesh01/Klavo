import mongoose from "mongoose";

const filterConfigSchema = new mongoose.Schema(
  {
    search: { type: String, default: "", trim: true },
    statuses: [{ type: String, trim: true }],
    priorities: [{ type: String, trim: true }],
    assignees: [{ type: String, trim: true }], // User IDs or special tokens e.g. "unassigned", "me"
    labels: [{ type: String, trim: true }],
    sprintId: { type: String, default: "all", trim: true }, // "all", "backlog", or sprint ObjectId
    milestoneId: { type: String, default: "all", trim: true }, // "all", "none", or milestone ObjectId
    parentId: { type: String, default: "all", trim: true }, // "all", "null" (top-level only), or parent ObjectId
    dueDateFilter: {
      type: String,
      enum: ["all", "overdue", "today", "this_week", "next_week", "no_due_date"],
      default: "all",
    },
    dependencyFilter: {
      type: String,
      enum: ["all", "blocked_only", "unblocked_only", "has_dependencies", "no_dependencies"],
      default: "all",
    },
    customFieldFilters: [
      {
        name: { type: String, required: true, trim: true },
        operator: {
          type: String,
          enum: ["equals", "contains", "exists", "not_empty"],
          default: "equals",
        },
        value: { type: mongoose.Schema.Types.Mixed },
      },
    ],
  },
  { _id: false }
);

const savedViewSchema = new mongoose.Schema(
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isShared: {
      type: Boolean,
      default: false, // false = personal view, true = shared with all project members
    },
    viewType: {
      type: String,
      enum: ["kanban", "backlog", "all"],
      default: "all",
    },
    // Filter parameters
    filters: {
      type: filterConfigSchema,
      default: () => ({}),
    },
    // Sort configuration
    sortBy: {
      type: String,
      enum: ["order", "createdAt", "updatedAt", "dueDate", "priority", "title", "estimatedHours"],
      default: "order",
    },
    sortOrder: {
      type: String,
      enum: ["asc", "desc"],
      default: "asc",
    },
    // Grouping configuration
    groupBy: {
      type: String,
      enum: ["none", "status", "priority", "assignee", "milestone", "sprint"],
      default: "none",
    },
    // Visual / UI preferences
    columns: [{ type: String }], // Visible status columns or field list
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Performance compound indexes
savedViewSchema.index({ projectId: 1, createdBy: 1 });
savedViewSchema.index({ projectId: 1, isShared: 1 });
savedViewSchema.index({ projectId: 1, isShared: 1, isDefault: 1 });

export default mongoose.model("SavedView", savedViewSchema);

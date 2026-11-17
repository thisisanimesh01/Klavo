import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },

    // task status (supports custom workflow statuses)
    status: {
      type: String,
      required: true,
      default: "todo",
      trim: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical", "urgent"],
      default: "medium",
    },

    // Sprint association (null = backlog)
    sprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null,
    },

    // Project Milestone association
    milestoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Milestone",
      default: null,
    },

    // Subtask hierarchy: parentId is null for top-level tasks
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    // Task dependencies (blocks, blocked-by, relates-to)
    dependencies: [
      {
        taskId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Task",
          required: true,
        },
        type: {
          type: String,
          enum: ["blocks", "blocked-by", "relates-to"],
          required: true,
        },
      },
    ],

    // Labels/Tags with name and customizable hex/color
    labels: [
      {
        name: { type: String, trim: true },
        color: { type: String, default: "#6366f1" },
      },
    ],

    // Dynamic custom fields
    customFields: [
      {
        name: { type: String, required: true },
        type: {
          type: String,
          enum: ["text", "number", "date", "dropdown", "checkbox"],
          default: "text",
        },
        value: { type: mongoose.Schema.Types.Mixed },
        options: [{ type: String }],
      },
    ],

    // Optional checklist items for breaking down tasks
    checklist: [
      {
        text: { type: String, required: true },
        completed: { type: Boolean, default: false },
      },
    ],

    // Optional estimation / tracking (hours and/or story points)
    estimatedHours: {
      type: Number,
      default: null,
    },

    storyPoints: {
      type: Number,
      default: null,
    },

    // Optional reference to template if instantiated from one
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskTemplate",
      default: null,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    order: {
      type: Number,
      default: 0,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Linked Documents & Knowledge Base Articles (DOC-08)
    linkedDocuments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
      },
    ],
  },
  { timestamps: true }
);

// Performance Indexes for Kanban boards, filters, sprints, labels, priorities, parent-child, dependencies, and linked docs
taskSchema.index({ projectId: 1, status: 1, order: 1 });
taskSchema.index({ projectId: 1, sprintId: 1, status: 1 });
taskSchema.index({ projectId: 1, parentId: 1 });
taskSchema.index({ parentId: 1 });
taskSchema.index({ "dependencies.taskId": 1 });
taskSchema.index({ projectId: 1, priority: 1 });
taskSchema.index({ projectId: 1, "labels.name": 1 });
taskSchema.index({ sprintId: 1 });
taskSchema.index({ milestoneId: 1 });
taskSchema.index({ projectId: 1, milestoneId: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ linkedDocuments: 1 });
taskSchema.index({ createdAt: -1 });

export default mongoose.model("Task", taskSchema);

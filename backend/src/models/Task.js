import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },

    // task status
    status: {
      type: String,
      enum: ["todo", "in-progress", "review", "done"],
      default: "todo",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical", "urgent"],
      default: "medium",
    },

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

    // Optional estimation / tracking
    estimatedHours: {
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
  },
  { timestamps: true }
);

// Performance Indexes for Kanban boards, filters, labels, priorities, and deadlines
taskSchema.index({ projectId: 1, status: 1, order: 1 });
taskSchema.index({ projectId: 1, priority: 1 });
taskSchema.index({ projectId: 1, "labels.name": 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdAt: -1 });

export default mongoose.model("Task", taskSchema);

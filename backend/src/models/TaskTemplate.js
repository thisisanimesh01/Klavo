import mongoose from "mongoose";

const taskTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    // Optional scoping: if projectId is null, template belongs to the entire team
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    // Default task blueprint values
    defaultTitle: {
      type: String,
      default: "",
    },
    defaultDescription: {
      type: String,
      default: "",
    },
    defaultPriority: {
      type: String,
      enum: ["low", "medium", "high", "critical", "urgent"],
      default: "medium",
    },
    defaultLabels: [
      {
        name: { type: String, trim: true },
        color: { type: String, default: "#6366f1" },
      },
    ],
    defaultCustomFields: [
      {
        name: { type: String, required: true },
        type: {
          type: String,
          enum: ["text", "number", "date", "dropdown", "checkbox"],
          default: "text",
        },
        value: { type: mongoose.Schema.Types.Mixed },
        options: [{ type: String }], // For dropdown type
      },
    ],
    checklist: [
      {
        text: { type: String, required: true },
        completed: { type: Boolean, default: false },
      },
    ],
    estimatedHours: {
      type: Number,
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

taskTemplateSchema.index({ teamId: 1 });
taskTemplateSchema.index({ projectId: 1 });
taskTemplateSchema.index({ createdAt: -1 });

export default mongoose.model("TaskTemplate", taskTemplateSchema);

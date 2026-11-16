import mongoose from "mongoose";

const recurringTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
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
    status: {
      type: String,
      default: "todo",
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical", "urgent"],
      default: "medium",
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    labels: [
      {
        name: { type: String, trim: true },
        color: { type: String, default: "#6366f1" },
      },
    ],
    estimatedHours: {
      type: Number,
      default: null,
    },
    sprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null,
    },
    milestoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Milestone",
      default: null,
    },
    // Recurrence schedule parameters
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      required: true,
    },
    interval: {
      type: Number,
      default: 1, // Every N days / weeks / months
      min: 1,
    },
    // For weekly recurrence: days of the week [0..6] (0 = Sunday, 1 = Monday...)
    daysOfWeek: [
      {
        type: Number,
        min: 0,
        max: 6,
      },
    ],
    // For monthly recurrence: day of the month [1..31]
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
      default: 1,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    timezone: {
      type: String,
      default: "UTC",
    },
    nextRunAt: {
      type: Date,
      required: true,
    },
    lastGeneratedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    totalGenerated: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

recurringTaskSchema.index({ projectId: 1, isActive: 1 });
recurringTaskSchema.index({ isActive: 1, nextRunAt: 1 });

export default mongoose.model("RecurringTask", recurringTaskSchema);

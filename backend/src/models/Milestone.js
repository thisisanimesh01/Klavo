import mongoose from "mongoose";

const milestoneSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ["planned", "in_progress", "completed", "archived"],
      default: "planned",
    },
    startDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
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
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Performance Indexes for milestones by project, team, status, and dates
milestoneSchema.index({ projectId: 1, status: 1 });
milestoneSchema.index({ teamId: 1, status: 1 });
milestoneSchema.index({ startDate: 1, dueDate: 1 });
milestoneSchema.index({ ownerId: 1 });
milestoneSchema.index({ createdAt: -1 });

export default mongoose.model("Milestone", milestoneSchema);

import mongoose from "mongoose";

const sprintSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    goal: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["planned", "active", "completed", "archived"],
      default: "planned",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    // Configurable sprint capacity in estimated hours (e.g. 40h per member or team target)
    capacity: {
      type: Number,
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Performance Indexes for sprints by project, team, and status
sprintSchema.index({ projectId: 1, status: 1 });
sprintSchema.index({ teamId: 1, status: 1 });
sprintSchema.index({ startDate: 1, endDate: 1 });
sprintSchema.index({ createdAt: -1 });

export default mongoose.model("Sprint", sprintSchema);

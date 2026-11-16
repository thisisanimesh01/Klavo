import mongoose from "mongoose";

const documentFolderSchema = new mongoose.Schema(
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
    color: {
      type: String,
      default: "#6366f1",
      trim: true,
    },
    icon: {
      type: String,
      default: "folder",
      trim: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DocumentFolder",
      default: null, // null = Root folder in the project
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
    order: {
      type: Number,
      default: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Tenancy, hierarchy, and ordering compound indexes
documentFolderSchema.index({ projectId: 1, parentId: 1, isArchived: 1 });
documentFolderSchema.index({ projectId: 1, order: 1 });
documentFolderSchema.index({ teamId: 1 });
documentFolderSchema.index({ createdBy: 1 });

export default mongoose.model("DocumentFolder", documentFolderSchema);

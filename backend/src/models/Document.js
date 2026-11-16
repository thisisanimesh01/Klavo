import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Untitled Document",
    },
    // TipTap / ProseMirror structured document representation (JSON object)
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [],
          },
        ],
      }),
    },
    // Sanitized HTML snapshot for preview and export
    contentHtml: {
      type: String,
      default: "<p></p>",
    },
    // Plain text excerpt for search index and quick previews
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
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Performance & tenancy indexes
documentSchema.index({ projectId: 1, isArchived: 1, updatedAt: -1 });
documentSchema.index({ teamId: 1 });
documentSchema.index({ createdBy: 1 });
documentSchema.index({ projectId: 1, title: 1 });

export default mongoose.model("Document", documentSchema);

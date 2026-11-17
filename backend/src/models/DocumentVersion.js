import mongoose from "mongoose";

const documentVersionSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    revisionNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    contentHtml: {
      type: String,
      default: "<p></p>",
    },
    description: {
      type: String,
      default: "",
    },
    yjsUpdate: {
      type: String,
      default: null,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isNamedSnapshot: {
      type: Boolean,
      default: false,
    },
    snapshotName: {
      type: String,
      default: null,
      trim: true,
    },
    changeSummary: {
      type: String,
      default: "Auto-saved snapshot",
      trim: true,
    },
    contentHash: {
      type: String,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for chronological querying and unique revision enforcement per document
documentVersionSchema.index({ documentId: 1, revisionNumber: -1 }, { unique: true });
documentVersionSchema.index({ documentId: 1, createdAt: -1 });

export default mongoose.model("DocumentVersion", documentVersionSchema);

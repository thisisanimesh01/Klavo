import mongoose from "mongoose";

const documentCommentSchema = new mongoose.Schema(
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
    // Null for root thread comments, populated for replies
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DocumentComment",
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    // Inline comment anchor attributes (optional; null for general document comments)
    anchor: {
      selectedText: { type: String, default: null }, // Quoted excerpt
      from: { type: Number, default: null },         // ProseMirror character index
      to: { type: Number, default: null },           // ProseMirror character index
    },
    // Resolution state for threads
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    // User mentions extracted from text
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Edit tracking
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Tenancy and sorting indexes
documentCommentSchema.index({ documentId: 1, parentCommentId: 1, createdAt: 1 });
documentCommentSchema.index({ documentId: 1, isResolved: 1 });
documentCommentSchema.index({ userId: 1 });

export default mongoose.model("DocumentComment", documentCommentSchema);

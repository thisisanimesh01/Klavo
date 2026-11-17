import mongoose from "mongoose";

const documentShareSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "editor", "commenter", "viewer"],
      default: "editor",
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

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
    // Base64 encoded binary snapshot of Yjs CRDT document state for conflict-free real-time sync
    yjsUpdate: {
      type: String,
      default: null,
    },
    // Folder association (null = Root / Unfiled)
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DocumentFolder",
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
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    // Default inherited access level for team members who don't have explicit share override
    defaultAccess: {
      type: String,
      enum: ["owner", "editor", "commenter", "viewer"],
      default: "editor",
    },
    // Granular direct document-level user access grants
    shares: {
      type: [documentShareSchema],
      default: [],
    },
    // Wiki / Knowledge Base extension (DOC-07)
    isWiki: {
      type: Boolean,
      default: false,
    },
    isWikiHome: {
      type: Boolean,
      default: false,
    },
    parentWikiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
    wikiOrder: {
      type: Number,
      default: 0,
    },
    wikiSlug: {
      type: String,
      default: null,
      trim: true,
    },
    // Direct Task Links (DOC-08)
    linkedTasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
  },
  { timestamps: true }
);

// Performance & tenancy indexes
documentSchema.index({ projectId: 1, isArchived: 1, updatedAt: -1 });
documentSchema.index({ projectId: 1, folderId: 1, isArchived: 1 });
documentSchema.index({ teamId: 1 });
documentSchema.index({ createdBy: 1 });
documentSchema.index({ projectId: 1, title: 1 });
documentSchema.index({ "shares.userId": 1 });
documentSchema.index({ projectId: 1, isWiki: 1, isArchived: 1 });
documentSchema.index({ projectId: 1, parentWikiId: 1, wikiOrder: 1 });
documentSchema.index({ projectId: 1, isWikiHome: 1 });
documentSchema.index({ linkedTasks: 1 });

export default mongoose.model("Document", documentSchema);

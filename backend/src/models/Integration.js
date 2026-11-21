import mongoose from "mongoose";

const integrationSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    // Type of integration: "github" | "slack" | "generic"
    provider: {
      type: String,
      enum: ["github", "slack", "generic"],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Config: non-secret metadata (e.g. repo name, channel name, scopes)
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Encrypted credentials / tokens at rest (AES-256-GCM)
    encryptedCredentials: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "revoked", "error", "pending"],
      default: "active",
      index: true,
    },
    lastSyncedAt: {
      type: Date,
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

integrationSchema.index({ workspaceId: 1, provider: 1 });
integrationSchema.index({ workspaceId: 1, status: 1 });

export default mongoose.model("Integration", integrationSchema);

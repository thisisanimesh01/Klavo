import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Prefix displayed to user (e.g., "klavo_live_a1b2...")
    keyPrefix: {
      type: String,
      required: true,
    },
    // SHA-256 hash of the complete API key
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Permission scopes: ["read:tasks", "write:tasks", "read:projects", "write:projects", "read:webhooks"]
    scopes: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
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

apiKeySchema.index({ workspaceId: 1, status: 1 });

export default mongoose.model("ApiKey", apiKeySchema);

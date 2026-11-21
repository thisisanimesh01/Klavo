import mongoose from "mongoose";

const webhookSubscriptionSchema = new mongoose.Schema(
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
    targetUrl: {
      type: String,
      required: true,
      trim: true,
    },
    // Subscribed event topics: ["task.created", "task.updated", "task.deleted", "comment.created", "*"]
    events: [
      {
        type: String,
        trim: true,
      },
    ],
    // Encrypted shared secret for outbound HMAC-SHA256 signing
    encryptedSecret: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Optional filter by project
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

webhookSubscriptionSchema.index({ workspaceId: 1, isActive: 1 });

export default mongoose.model("WebhookSubscription", webhookSubscriptionSchema);

import mongoose from "mongoose";

const webhookDeliveryLogSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WebhookSubscription",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
    },
    // Unique ID of delivery attempt for idempotency / trace
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    targetUrl: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    statusCode: {
      type: Number,
      default: null,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    attempt: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["success", "failed", "retrying"],
      default: "success",
      index: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

webhookDeliveryLogSchema.index({ subscriptionId: 1, createdAt: -1 });
webhookDeliveryLogSchema.index({ workspaceId: 1, createdAt: -1 });

export default mongoose.model("WebhookDeliveryLog", webhookDeliveryLogSchema);

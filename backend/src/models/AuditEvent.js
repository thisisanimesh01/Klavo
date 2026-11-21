import crypto from "crypto";
import mongoose from "mongoose";

const auditEventSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: false,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorEmail: {
      type: String,
      required: true,
    },
    actorRole: {
      type: String,
      default: "member",
    },
    action: {
      type: String,
      required: true,
      index: true, // e.g. "workspace.created", "member.role_updated", "policy.domain_restriction_enabled", "sso.configured"
    },
    targetType: {
      type: String,
      required: true, // "user", "workspace", "policy", "sso", "role", "api_key", "integration"
    },
    targetId: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: "127.0.0.1",
    },
    userAgent: {
      type: String,
      default: "",
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Tamper-evident cryptographic signature chain
    sequence: {
      type: Number,
      required: true,
      index: true,
    },
    previousHash: {
      type: String,
      required: true,
      default: "0".repeat(64), // Genesis block hash
    },
    hash: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

auditEventSchema.index({ workspaceId: 1, sequence: -1 });
auditEventSchema.index({ organizationId: 1, sequence: -1 });
auditEventSchema.index({ timestamp: -1 });

/**
 * Computes deterministic SHA256 hash for tamper resistance.
 */
auditEventSchema.statics.calculateHash = function (payload, previousHash) {
  const serialized = JSON.stringify({
    workspaceId: payload.workspaceId?.toString() || null,
    organizationId: payload.organizationId?.toString() || null,
    actorId: payload.actorId?.toString() || null,
    action: payload.action,
    targetType: payload.targetType,
    targetId: payload.targetId || null,
    details: payload.details || {},
    sequence: payload.sequence,
    previousHash: previousHash || "0".repeat(64),
  });
  return crypto.createHash("sha256").update(serialized).digest("hex");
};

export const AuditEvent = mongoose.model("AuditEvent", auditEventSchema);
export default AuditEvent;

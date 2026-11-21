import AuditEvent from "../models/AuditEvent.js";
import { logger } from "../utils/logger.js";

/**
 * Service providing centralized, tamper-resistant audit logging for enterprise security events.
 */
export class AuditService {
  /**
   * Records an audit event with sequential chaining and cryptographic hashing.
   *
   * @param {object} params
   * @param {string|ObjectId} [params.workspaceId]
   * @param {string|ObjectId} [params.organizationId]
   * @param {string|ObjectId} params.actorId
   * @param {string} params.actorEmail
   * @param {string} [params.actorRole="member"]
   * @param {string} params.action - e.g. "member.role_updated", "policy.domain_restriction_enabled"
   * @param {string} params.targetType - e.g. "user", "workspace", "policy"
   * @param {string} [params.targetId]
   * @param {object} [params.details={}]
   * @param {string} [params.ipAddress="127.0.0.1"]
   * @param {string} [params.userAgent=""]
   */
  async recordEvent({
    workspaceId = null,
    organizationId = null,
    actorId,
    actorEmail,
    actorRole = "member",
    action,
    targetType,
    targetId = null,
    details = {},
    ipAddress = "127.0.0.1",
    userAgent = "",
  }) {
    try {
      // Find the last recorded audit event for this scope to maintain sequential hash chain
      const scopeFilter = workspaceId ? { workspaceId } : organizationId ? { organizationId } : {};
      const lastEvent = await AuditEvent.findOne(scopeFilter).sort({ sequence: -1 });

      const sequence = lastEvent ? lastEvent.sequence + 1 : 1;
      const previousHash = lastEvent ? lastEvent.hash : "0".repeat(64);

      const candidatePayload = {
        workspaceId,
        organizationId,
        actorId,
        action,
        targetType,
        targetId,
        details,
        sequence,
      };

      const hash = AuditEvent.calculateHash(candidatePayload, previousHash);

      const event = await AuditEvent.create({
        workspaceId,
        organizationId,
        actorId,
        actorEmail,
        actorRole,
        action,
        targetType,
        targetId,
        ipAddress,
        userAgent,
        details,
        sequence,
        previousHash,
        hash,
        timestamp: new Date(),
      });

      return event;
    } catch (err) {
      logger.error("Failed to record enterprise audit event:", { error: err.message, action });
      return null;
    }
  }

  /**
   * Verifies the cryptographic chain integrity of audit logs for a workspace or organization.
   *
   * @param {object} query - Filter e.g. { workspaceId } or { organizationId }
   * @returns {Promise<{ valid: boolean, totalChecked: number, compromisedIndex: number|null }>}
   */
  async verifyChainIntegrity(query = {}) {
    const events = await AuditEvent.find(query).sort({ sequence: 1 });
    if (!events || events.length === 0) {
      return { valid: true, totalChecked: 0, compromisedIndex: null };
    }

    let expectedPrevHash = "0".repeat(64);

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];

      // 1. Verify previous hash pointer
      if (ev.previousHash !== expectedPrevHash) {
        return { valid: false, totalChecked: i, compromisedIndex: i, reason: "broken_hash_link" };
      }

      // 2. Recompute hash from content
      const recalculated = AuditEvent.calculateHash(
        {
          workspaceId: ev.workspaceId,
          organizationId: ev.organizationId,
          actorId: ev.actorId,
          action: ev.action,
          targetType: ev.targetType,
          targetId: ev.targetId,
          details: ev.details,
          sequence: ev.sequence,
        },
        ev.previousHash
      );

      if (recalculated !== ev.hash) {
        return { valid: false, totalChecked: i, compromisedIndex: i, reason: "tampered_content" };
      }

      expectedPrevHash = ev.hash;
    }

    return { valid: true, totalChecked: events.length, compromisedIndex: null };
  }
}

export const auditService = new AuditService();

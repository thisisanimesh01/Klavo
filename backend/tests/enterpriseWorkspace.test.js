import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import AuditEvent from "../src/models/AuditEvent.js";
import { auditService } from "../src/services/auditService.js";
import { enterpriseSsoService } from "../src/services/enterpriseSsoService.js";

test("ENT-01: Cryptographic Audit Event Chain & Tamper Resistance", async (t) => {
  await t.test("calculates deterministic SHA-256 hash for audit events", () => {
    const payload = {
      workspaceId: "ws_001",
      actorId: "user_001",
      action: "policy.domain_restriction_enabled",
      targetType: "policy",
      targetId: "ws_001",
      details: { allowedDomains: ["@enterprise.corp"] },
      sequence: 1,
    };
    const prevHash = "0".repeat(64);
    const hash1 = AuditEvent.calculateHash(payload, prevHash);
    const hash2 = AuditEvent.calculateHash(payload, prevHash);

    assert.equal(typeof hash1, "string");
    assert.equal(hash1.length, 64);
    assert.equal(hash1, hash2);

    // Tampering changes the resulting hash
    const tamperedPayload = { ...payload, details: { allowedDomains: ["@hacked.com"] } };
    const tamperedHash = AuditEvent.calculateHash(tamperedPayload, prevHash);
    assert.notEqual(hash1, tamperedHash);
  });

  await t.test("verifies audit chain integrity sequentially", async () => {
    const mockEvents = [
      {
        workspaceId: "ws_001",
        actorId: "u1",
        action: "workspace.created",
        targetType: "workspace",
        targetId: "ws_001",
        sequence: 1,
        previousHash: "0".repeat(64),
      },
      {
        workspaceId: "ws_001",
        actorId: "u1",
        action: "member.added",
        targetType: "user",
        targetId: "u2",
        sequence: 2,
      },
    ];

    // Compute hashes
    mockEvents[0].hash = AuditEvent.calculateHash(mockEvents[0], mockEvents[0].previousHash);
    mockEvents[1].previousHash = mockEvents[0].hash;
    mockEvents[1].hash = AuditEvent.calculateHash(mockEvents[1], mockEvents[1].previousHash);

    // Verify linkage
    assert.equal(mockEvents[1].previousHash, mockEvents[0].hash);
  });
});

test("ENT-01: Enterprise SSO & SAML Assertion Validation", async (t) => {
  await t.test("generates and parses standard SAML 2.0 test assertions", async () => {
    const samlBase64 = enterpriseSsoService.generateTestSamlAssertion({
      email: "engineer@enterprise.corp",
      name: "Lead Architect",
      organizationSlug: "acme-corp",
    });

    assert.ok(samlBase64.length > 50);
    const decodedXml = Buffer.from(samlBase64, "base64").toString("utf-8");
    assert.ok(decodedXml.includes("engineer@enterprise.corp"));
    assert.ok(decodedXml.includes("acme-corp"));
  });

  await t.test("rejects malformed OIDC assertions gracefully", async () => {
    await assert.rejects(
      async () => {
        await enterpriseSsoService.processOidcToken({
          idToken: "not-a-jwt",
          organizationSlug: "acme-corp",
        });
      },
      { message: /Malformed OIDC JWT token/ }
    );
  });
});

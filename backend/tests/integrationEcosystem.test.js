import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import crypto from "crypto";
import {
  encryptSecret,
  decryptSecret,
  computeWebhookSignature,
  verifyWebhookSignature,
  redactSensitiveData,
} from "../src/utils/cryptoHelpers.js";
import { integrationService } from "../src/services/integrationService.js";
import Integration from "../src/models/Integration.js";
import WebhookSubscription from "../src/models/WebhookSubscription.js";
import WebhookDeliveryLog from "../src/models/WebhookDeliveryLog.js";
import ApiKey from "../src/models/ApiKey.js";
import { Team } from "../src/models/Team.js";
import { User } from "../src/models/User.js";
import { Project } from "../src/models/Project.js";

describe("INT-01: Integrations, Webhooks & Developer Ecosystem Architecture", () => {
  const secretKey = "test-crypto-secret-key-32-chars-ok!!";

  describe("1. Cryptographic Security & Credentials at Rest", () => {
    it("encrypts and decrypts secrets using AES-256-GCM authenticated encryption", () => {
      const plaintext = "ghp_secure_github_personal_access_token_12345";
      const encryptedHex = encryptSecret(plaintext, secretKey);

      assert.notEqual(encryptedHex, plaintext);
      assert.ok(encryptedHex.length > 32);

      const decrypted = decryptSecret(encryptedHex, secretKey);
      assert.equal(decrypted, plaintext);
    });

    it("rejects tampered ciphertexts with authentication error", () => {
      const plaintext = "slack_bot_token_secret_xyz";
      const encryptedHex = encryptSecret(plaintext, secretKey);

      // Flip byte in ciphertext
      const tamperedHex = encryptedHex.slice(0, -2) + (encryptedHex.slice(-2) === "aa" ? "bb" : "aa");
      assert.throws(() => decryptSecret(tamperedHex, secretKey), /Failed to decrypt secret/);
    });

    it("redacts sensitive tokens and passwords from objects and log strings", () => {
      const sensitiveObj = {
        name: "Webhook Job",
        accessToken: "secret-token-xyz",
        nested: {
          webhookSecret: "super-secret-123",
          normalField: "public-data",
        },
      };

      const redacted = redactSensitiveData(sensitiveObj);
      assert.equal(redacted.accessToken, "[REDACTED]");
      assert.equal(redacted.nested.webhookSecret, "[REDACTED]");
      assert.equal(redacted.nested.normalField, "public-data");

      const logStr = "Request failed with Authorization: Bearer ghp_123456789";
      assert.equal(redactSensitiveData(logStr), "Request failed with Authorization: Bearer [REDACTED]");
    });
  });

  describe("2. Webhook HMAC Signatures & Replay Prevention", () => {
    const payload = JSON.stringify({ id: "evt_123", event: "task.created", task: "Build integration" });
    const webhookSecret = "whsec_test_shared_secret_abc123";

    it("computes standard HMAC-SHA256 signature prefixed with sha256=", () => {
      const sig = computeWebhookSignature(payload, webhookSecret);
      assert.ok(sig.startsWith("sha256="));
      assert.equal(sig.length, 7 + 64);
    });

    it("verifies matching signatures in constant time and rejects altered payloads", () => {
      const sig = computeWebhookSignature(payload, webhookSecret);
      assert.equal(verifyWebhookSignature(payload, sig, webhookSecret), true);

      // Altered payload fails verification
      assert.equal(verifyWebhookSignature(payload + " ", sig, webhookSecret), false);

      // Altered secret fails verification
      assert.equal(verifyWebhookSignature(payload, sig, "wrong_secret"), false);
    });
  });

  describe("3. GitHub Inbound Event Processing & Linking", () => {
    it("parses push event commits and formats integration activities", async () => {
      const fakeWorkspaceId = new mongoose.Types.ObjectId();
      const pushPayload = {
        repository: { full_name: "acme/repo" },
        commits: [
          {
            id: "a1b2c3d4e5f6",
            message: "fix(auth): resolve JWT expiration issue #101",
            url: "https://github.com/acme/repo/commit/a1b2c3d",
            author: { name: "Dev Engineer" },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const activities = await integrationService.processGitHubWebhook({
        workspaceId: fakeWorkspaceId,
        event: "push",
        payload: pushPayload,
      });

      assert.equal(activities.length, 1);
      assert.equal(activities[0].activityType, "commit");
      assert.equal(activities[0].externalId, "a1b2c3d");
      assert.equal(activities[0].title, "fix(auth): resolve JWT expiration issue #101");
    });

    it("parses pull request events into structured integration activity", async () => {
      const fakeWorkspaceId = new mongoose.Types.ObjectId();
      const prPayload = {
        action: "opened",
        pull_request: {
          number: 42,
          title: "Feature: Add developer API endpoints",
          html_url: "https://github.com/acme/repo/pull/42",
          state: "open",
          merged: false,
          user: { login: "octocat" },
        },
      };

      const activities = await integrationService.processGitHubWebhook({
        workspaceId: fakeWorkspaceId,
        event: "pull_request",
        payload: prPayload,
      });

      assert.equal(activities.length, 1);
      assert.equal(activities[0].activityType, "pull_request");
      assert.equal(activities[0].externalId, "#42");
      assert.equal(activities[0].title, "PR #42: Feature: Add developer API endpoints");
    });
  });

  describe("4. Outbound Webhook Delivery & Exponential Backoff Retries", () => {
    it("delivers payload successfully on 200 response and records delivery log", async () => {
      const fakeSub = {
        _id: new mongoose.Types.ObjectId(),
        workspaceId: new mongoose.Types.ObjectId(),
        targetUrl: "https://mock.service.io/webhook",
        encryptedSecret: encryptSecret("whsec_test"),
      };

      let deliveredHeaders = null;
      let deliveredBody = null;
      const mockFetch = async (url, options) => {
        deliveredHeaders = options.headers;
        deliveredBody = JSON.parse(options.body);
        return { ok: true, status: 200 };
      };

      // Mock create so DB connection is not strictly required for unit logic
      const originalCreate = WebhookDeliveryLog.create;
      WebhookDeliveryLog.create = async (doc) => doc;

      try {
        const log = await integrationService.deliverWebhook({
          subscription: fakeSub,
          event: "task.created",
          payload: { title: "Test task" },
          fetchFn: mockFetch,
          maxAttempts: 2,
        });

        assert.equal(log.status, "success");
        assert.equal(log.statusCode, 200);
        assert.equal(log.attempt, 1);
        assert.ok(deliveredHeaders["X-Klavo-Signature-256"].startsWith("sha256="));
        assert.equal(deliveredBody.event, "task.created");
      } finally {
        WebhookDeliveryLog.create = originalCreate;
      }
    });

    it("retries on temporary failure and marks log as failed when max attempts exhausted", async () => {
      const fakeSub = {
        _id: new mongoose.Types.ObjectId(),
        workspaceId: new mongoose.Types.ObjectId(),
        targetUrl: "https://failing.service.io/webhook",
        encryptedSecret: encryptSecret("whsec_test"),
      };

      let callCount = 0;
      const mockFailingFetch = async () => {
        callCount++;
        return { ok: false, status: 503, statusText: "Service Unavailable" };
      };

      const originalCreate = WebhookDeliveryLog.create;
      WebhookDeliveryLog.create = async (doc) => doc;
      const originalUpdate = WebhookSubscription.findByIdAndUpdate;
      WebhookSubscription.findByIdAndUpdate = async () => ({});

      try {
        const log = await integrationService.deliverWebhook({
          subscription: fakeSub,
          event: "task.updated",
          payload: { title: "Failing task" },
          fetchFn: mockFailingFetch,
          maxAttempts: 2,
        });

        assert.equal(callCount, 2);
        assert.equal(log.status, "failed");
        assert.equal(log.statusCode, 503);
        assert.equal(log.attempt, 2);
      } finally {
        WebhookDeliveryLog.create = originalCreate;
        WebhookSubscription.findByIdAndUpdate = originalUpdate;
      }
    });
  });

  describe("5. Slack Outbound Notification Resilience", () => {
    it("gracefully catches network outages without throwing unhandled exceptions", async () => {
      const failingFetch = async () => {
        throw new Error("getaddrinfo ENOTFOUND hooks.slack.com");
      };

      const res = await integrationService.sendSlackNotification({
        webhookUrl: "https://hooks.slack.com/services/T00/B00/X00",
        message: "Test slack broadcast",
        fetchFn: failingFetch,
      });

      assert.equal(res.success, false);
      assert.match(res.error, /ENOTFOUND/);
    });
  });
});

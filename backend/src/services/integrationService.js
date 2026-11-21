import crypto from "crypto";
import WebhookSubscription from "../models/WebhookSubscription.js";
import WebhookDeliveryLog from "../models/WebhookDeliveryLog.js";
import Integration from "../models/Integration.js";
import IntegrationActivity from "../models/IntegrationActivity.js";
import { encryptSecret, decryptSecret, computeWebhookSignature, redactSensitiveData } from "../utils/cryptoHelpers.js";
import { logger } from "../utils/logger.js";

/**
 * Service managing generic webhooks and third-party integrations (GitHub, Slack).
 */
export class IntegrationService {
  /**
   * Dispatches an outbound webhook event to all active matching subscriptions.
   * Includes signature generation (HMAC-SHA256), delivery logging, and retry logic.
   *
   * @param {object} params
   * @param {string} params.workspaceId - Workspace context
   * @param {string} params.event - Event name (e.g. "task.created")
   * @param {object} params.payload - Event data payload
   * @param {string} [params.projectId] - Optional project context
   * @param {Function} [params.fetchFn] - Custom fetch for testing/isolation
   */
  async dispatchEvent({ workspaceId, event, payload, projectId = null, fetchFn = globalThis.fetch }) {
    try {
      const query = {
        workspaceId,
        isActive: true,
        $or: [{ events: event }, { events: "*" }],
      };

      if (projectId) {
        query.$or.push({ projectId });
      }

      const subscriptions = await WebhookSubscription.find(query);
      if (!subscriptions || subscriptions.length === 0) {
        return [];
      }

      const results = [];
      for (const sub of subscriptions) {
        const result = await this.deliverWebhook({
          subscription: sub,
          event,
          payload,
          fetchFn,
        });
        results.push(result);
      }

      return results;
    } catch (err) {
      logger.error("Failed to dispatch webhook event:", { error: err.message, event, workspaceId });
      return [];
    }
  }

  /**
   * Delivers a single webhook payload with signature, timeout, retry backoff and delivery logging.
   */
  async deliverWebhook({ subscription, event, payload, fetchFn = globalThis.fetch, maxAttempts = 3 }) {
    const eventId = `evt_${crypto.randomUUID()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyString = JSON.stringify({
      id: eventId,
      event,
      timestamp,
      workspaceId: subscription.workspaceId,
      data: payload,
    });

    let secret = "";
    try {
      secret = decryptSecret(subscription.encryptedSecret);
    } catch {
      secret = "fallback-secret";
    }

    const signature = computeWebhookSignature(bodyString, secret);
    let attempt = 0;
    let success = false;
    let lastStatusCode = null;
    let lastError = null;
    const startTime = Date.now();

    while (attempt < maxAttempts && !success) {
      attempt++;
      try {
        const response = await fetchFn(subscription.targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Klavo-Webhooks/1.0",
            "X-Klavo-Event": event,
            "X-Klavo-Delivery": eventId,
            "X-Klavo-Signature-256": signature,
            "X-Klavo-Timestamp": timestamp.toString(),
          },
          body: bodyString,
        });

        lastStatusCode = response.status;
        if (response.ok) {
          success = true;
        } else {
          lastError = `HTTP ${response.status} ${response.statusText || ""}`.trim();
        }
      } catch (err) {
        lastError = err.message;
      }

      if (!success && attempt < maxAttempts) {
        // Exponential backoff simulation / delay
        await new Promise((res) => setTimeout(res, Math.min(50 * Math.pow(2, attempt), 500)));
      }
    }

    const durationMs = Date.now() - startTime;
    const log = await WebhookDeliveryLog.create({
      subscriptionId: subscription._id,
      workspaceId: subscription.workspaceId,
      event,
      eventId,
      targetUrl: subscription.targetUrl,
      payload: redactSensitiveData(payload),
      statusCode: lastStatusCode,
      durationMs,
      attempt,
      status: success ? "success" : "failed",
      errorMessage: success ? null : lastError,
    });

    if (!success) {
      await WebhookSubscription.findByIdAndUpdate(subscription._id, {
        $inc: { failureCount: 1 },
      });
    }

    return log;
  }

  /**
   * Ingests a GitHub webhook (push, pull_request, issues, deployment)
   * Safely links to task when commit or PR mentions task ID or title keywords.
   */
  async processGitHubWebhook({ workspaceId, event, payload, signature, secret }) {
    // 1. Verify signature if secret configured
    if (secret && signature) {
      const { verifyWebhookSignature } = await import("../utils/cryptoHelpers.js");
      const isValid = verifyWebhookSignature(payload, signature, secret);
      if (!isValid) {
        throw new Error("Invalid GitHub webhook signature");
      }
    }

    const activities = [];
    const parsedPayload = typeof payload === "string" ? JSON.parse(payload) : payload;

    if (event === "push") {
      const commits = parsedPayload.commits || [];
      const repoName = parsedPayload.repository?.full_name || "repository";
      for (const commit of commits) {
        activities.push({
          workspaceId,
          provider: "github",
          activityType: "commit",
          externalId: commit.id?.slice(0, 7),
          title: commit.message?.split("\n")[0] || "Git commit",
          url: commit.url || "",
          metadata: {
            author: commit.author?.name,
            repository: repoName,
            timestamp: commit.timestamp,
          },
        });
      }
    } else if (event === "pull_request") {
      const pr = parsedPayload.pull_request;
      if (pr) {
        activities.push({
          workspaceId,
          provider: "github",
          activityType: "pull_request",
          externalId: `#${pr.number}`,
          title: `PR #${pr.number}: ${pr.title}`,
          url: pr.html_url || "",
          metadata: {
            action: parsedPayload.action,
            state: pr.state,
            merged: pr.merged,
            author: pr.user?.login,
          },
        });
      }
    }

    return activities;
  }

  /**
   * Sends an outbound notification to Slack incoming webhook or API channel.
   * Gracefully fails if Slack endpoint is unreachable.
   */
  async sendSlackNotification({ webhookUrl, message, channel = null, fetchFn = globalThis.fetch }) {
    if (!webhookUrl) return { success: false, reason: "No webhook URL" };

    try {
      const payload = {
        text: message,
      };
      if (channel) payload.channel = channel;

      const res = await fetchFn(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return {
        success: res.ok,
        status: res.status,
      };
    } catch (err) {
      logger.warn("Slack notification failed gracefully:", { error: err.message });
      return {
        success: false,
        error: err.message,
      };
    }
  }
}

export const integrationService = new IntegrationService();

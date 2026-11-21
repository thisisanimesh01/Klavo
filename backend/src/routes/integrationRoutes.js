import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/rateLimiter.js";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listIntegrations,
  configureIntegration,
  removeIntegration,
  listWebhookSubscriptions,
  createWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookDeliveryLogs,
  handleInboundGitHubWebhook,
  listIntegrationActivities,
} from "../controllers/integrationController.js";

const router = express.Router();

const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: "Too many webhook requests, please rate limit client.",
});

// 1. API Keys (Protected)
router.get("/api-keys/workspace/:workspaceId", authRequired, listApiKeys);
router.post("/api-keys/workspace/:workspaceId", authRequired, createApiKey);
router.post("/api-keys/:id/revoke", authRequired, revokeApiKey);

// 2. Integrations Config (GitHub, Slack)
router.get("/workspace/:workspaceId", authRequired, listIntegrations);
router.post("/workspace/:workspaceId", authRequired, configureIntegration);
router.delete("/:id", authRequired, removeIntegration);

// 3. Webhook Subscriptions
router.get("/webhooks/workspace/:workspaceId", authRequired, listWebhookSubscriptions);
router.post("/webhooks/workspace/:workspaceId", authRequired, createWebhookSubscription);
router.delete("/webhooks/:id", authRequired, deleteWebhookSubscription);
router.get("/webhooks/:subscriptionId/logs", authRequired, listWebhookDeliveryLogs);

// 4. Inbound Webhooks (Public / HMAC authenticated)
router.post("/inbound/github/:workspaceId", webhookRateLimiter, handleInboundGitHubWebhook);

// 5. Integration Activity Feed
router.get("/activity/project/:projectId", authRequired, listIntegrationActivities);

export default router;

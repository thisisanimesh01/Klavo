import crypto from "crypto";
import ApiKey from "../models/ApiKey.js";
import Integration from "../models/Integration.js";
import WebhookSubscription from "../models/WebhookSubscription.js";
import WebhookDeliveryLog from "../models/WebhookDeliveryLog.js";
import IntegrationActivity from "../models/IntegrationActivity.js";
import { checkTeamAccess, resolveWorkspaceRole } from "../utils/authHelpers.js";
import { encryptSecret, decryptSecret, verifyWebhookSignature, redactSensitiveData } from "../utils/cryptoHelpers.js";
import { integrationService } from "../services/integrationService.js";
import { logger } from "../utils/logger.js";

// ==========================================
// 1. API Keys Management
// ==========================================

export const listApiKeys = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const access = await checkTeamAccess(workspaceId, req.user._id);
    if (!access.isMember) {
      return res.status(403).json({ message: "Access denied to workspace" });
    }

    const keys = await ApiKey.find({ workspaceId }).sort({ createdAt: -1 });
    res.json(
      keys.map((k) => ({
        _id: k._id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        status: k.status,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createApiKey = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, scopes = ["read:tasks", "write:tasks"], expiresAt } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "API key name is required" });
    }

    const access = await checkTeamAccess(workspaceId, req.user._id);
    if (!access.isMember) {
      return res.status(403).json({ message: "Access denied to workspace" });
    }

    const role = resolveWorkspaceRole(access.team, req.user._id);
    if (role !== "owner" && role !== "admin") {
      return res.status(403).json({ message: "Only workspace owners and admins can create API keys" });
    }

    // Generate cryptographically secure API key: klavo_live_<32 hex chars>
    const randomBytes = crypto.randomBytes(24).toString("hex");
    const rawKey = `klavo_live_${randomBytes}`;
    const keyPrefix = `klavo_live_${randomBytes.slice(0, 6)}...`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await ApiKey.create({
      workspaceId,
      name: name.trim(),
      keyPrefix,
      keyHash,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user._id,
    });

    res.status(201).json({
      apiKey: {
        _id: apiKey._id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        status: apiKey.status,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      rawKey, // Returned ONLY on initial creation
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const revokeApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = await ApiKey.findById(id);
    if (!apiKey) {
      return res.status(404).json({ message: "API key not found" });
    }

    const access = await checkTeamAccess(apiKey.workspaceId, req.user._id);
    if (!access.isMember) {
      return res.status(403).json({ message: "Access denied to workspace" });
    }

    const role = resolveWorkspaceRole(access.team, req.user._id);
    if (role !== "owner" && role !== "admin") {
      return res.status(403).json({ message: "Only workspace owners and admins can revoke API keys" });
    }

    apiKey.status = "revoked";
    await apiKey.save();

    res.json({ message: "API key revoked successfully", apiKeyId: apiKey._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ==========================================
// 2. Integrations Management (GitHub, Slack)
// ==========================================

export const listIntegrations = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const access = await checkTeamAccess(workspaceId, req.user._id);
    if (!access.isMember) {
      return res.status(403).json({ message: "Access denied to workspace" });
    }

    const integrations = await Integration.find({ workspaceId }).sort({ createdAt: -1 });
    res.json(
      integrations.map((i) => ({
        _id: i._id,
        provider: i.provider,
        name: i.name,
        config: i.config,
        status: i.status,
        lastSyncedAt: i.lastSyncedAt,
        createdAt: i.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const configureIntegration = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { provider, name, config = {}, credentials = "" } = req.body;

    if (!provider || !["github", "slack", "generic"].includes(provider)) {
      return res.status(400).json({ message: "Valid provider ('github', 'slack', 'generic') is required" });
    }

    const access = await checkTeamAccess(workspaceId, req.user._id);
    if (!access.isMember) {
      return res.status(403).json({ message: "Access denied to workspace" });
    }

    const role = resolveWorkspaceRole(access.team, req.user._id);
    if (role !== "owner" && role !== "admin") {
      return res.status(403).json({ message: "Only workspace owners and admins can configure integrations" });
    }

    let encryptedCredentials = "";
    if (credentials) {
      encryptedCredentials = encryptSecret(typeof credentials === "string" ? credentials : JSON.stringify(credentials));
    }

    const integration = await Integration.create({
      workspaceId,
      provider,
      name: name || `${provider.toUpperCase()} Integration`,
      config,
      encryptedCredentials,
      status: "active",
      createdBy: req.user._id,
    });

    res.status(201).json({
      _id: integration._id,
      provider: integration.provider,
      name: integration.name,
      config: integration.config,
      status: integration.status,
      createdAt: integration.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const removeIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    const integration = await Integration.findById(id);
    if (!integration) {
      return res.status(404).json({ message: "Integration not found" });
    }

    const access = await checkTeamAccess(integration.workspaceId, req.user._id);
    if (!access.isMember) {
      return res.status(403).json({ message: "Access denied to workspace" });
    }

    await Integration.findByIdAndDelete(id);
    res.json({ message: "Integration removed successfully", integrationId: id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ==========================================
// 3. Webhook Subscriptions & Deliveries
// ==========================================

export const listWebhookSubscriptions = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const access = await checkTeamAccess(workspaceId, req.user._id);
    if (!access.isMember) {
      return res.status(403).json({ message: "Access denied to workspace" });
    }

    const subs = await WebhookSubscription.find({ workspaceId }).sort({ createdAt: -1 });
    res.json(
      subs.map((s) => ({
        _id: s._id,
        name: s.name,
        targetUrl: s.targetUrl,
        events: s.events,
        isActive: s.isActive,
        projectId: s.projectId,
        failureCount: s.failureCount,
        createdAt: s.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createWebhookSubscription = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, targetUrl, events = ["*"], projectId = null, secret } = req.body;

    if (!name || !targetUrl) {
      return res.status(400).json({ message: "Name and target URL are required" });
    }

    // URL validation
    try {
      new URL(targetUrl);
    } catch {
      return res.status(400).json({ message: "Target URL must be a valid HTTP or HTTPS URL" });
    }

    const access = await checkTeamAccess(workspaceId, req.user._id);
    if (!access.isMember) {
      return res.status(403).json({ message: "Access denied to workspace" });
    }

    const role = resolveWorkspaceRole(access.team, req.user._id);
    if (role !== "owner" && role !== "admin") {
      return res.status(403).json({ message: "Only workspace owners and admins can configure webhooks" });
    }

    const sharedSecret = secret || crypto.randomBytes(24).toString("hex");
    const encryptedSecret = encryptSecret(sharedSecret);

    const subscription = await WebhookSubscription.create({
      workspaceId,
      name: name.trim(),
      targetUrl: targetUrl.trim(),
      events,
      encryptedSecret,
      projectId,
      createdBy: req.user._id,
    });

    res.status(201).json({
      subscription: {
        _id: subscription._id,
        name: subscription.name,
        targetUrl: subscription.targetUrl,
        events: subscription.events,
        isActive: subscription.isActive,
        projectId: subscription.projectId,
        createdAt: subscription.createdAt,
      },
      secret: sharedSecret, // Returned once for user configuration
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteWebhookSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await WebhookSubscription.findById(id);
    if (!sub) {
      return res.status(404).json({ message: "Webhook subscription not found" });
    }

    const access = await checkTeamAccess(sub.workspaceId, req.user._id);
    if (!access.isMember) {
      return res.status(403).json({ message: "Access denied to workspace" });
    }

    await WebhookSubscription.findByIdAndDelete(id);
    await WebhookDeliveryLog.deleteMany({ subscriptionId: id });

    res.json({ message: "Webhook subscription deleted successfully", id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listWebhookDeliveryLogs = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const sub = await WebhookSubscription.findById(subscriptionId);
    if (!sub) {
      return res.status(404).json({ message: "Webhook subscription not found" });
    }

    const access = await checkTeamAccess(sub.workspaceId, req.user._id);
    if (!access.isMember) {
      return res.status(403).json({ message: "Access denied to workspace" });
    }

    const logs = await WebhookDeliveryLog.find({ subscriptionId }).sort({ createdAt: -1 }).limit(50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ==========================================
// 4. Inbound Webhooks (GitHub / Generic)
// ==========================================

export const handleInboundGitHubWebhook = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const event = req.headers["x-github-event"] || "push";
    const signature = req.headers["x-hub-signature-256"];

    // Find integration configuration for GitHub
    const integration = await Integration.findOne({ workspaceId, provider: "github", status: "active" });
    let secret = null;
    if (integration && integration.encryptedCredentials) {
      try {
        secret = decryptSecret(integration.encryptedCredentials);
      } catch {
        // Continue
      }
    }

    const activities = await integrationService.processGitHubWebhook({
      workspaceId,
      event,
      payload: req.body,
      signature,
      secret,
    });

    if (activities.length > 0) {
      // Find default or referenced project if exists
      const { Project } = await import("../models/Project.js");
      const defaultProject = await Project.findOne({ teamId: workspaceId });
      const projectId = defaultProject ? defaultProject._id : null;

      if (projectId) {
        for (const act of activities) {
          await IntegrationActivity.create({
            ...act,
            projectId,
          });
        }
      }
    }

    res.json({ success: true, processedEvents: activities.length });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ==========================================
// 5. Integration Activity Feed
// ==========================================

export const listIntegrationActivities = async (req, res) => {
  try {
    const { projectId } = req.params;
    const activities = await IntegrationActivity.find({ projectId }).sort({ createdAt: -1 }).limit(30);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

import crypto from "crypto";
import ApiKey from "../models/ApiKey.js";
import { Team } from "../models/Team.js";

/**
 * Middleware authenticating requests via API Key or falling back to JWT auth.
 * Validates active status, expiration, and extracts permission scopes.
 */
export const apiKeyOrJwtAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers["x-api-key"];

  // 1. Check for API key in header (e.g. X-API-Key: klavo_live_...) or Authorization: Bearer klavo_...
  let rawApiKey = apiKeyHeader;
  if (!rawApiKey && authHeader && authHeader.startsWith("Bearer klavo_")) {
    rawApiKey = authHeader.replace(/^Bearer\s+/i, "");
  }

  if (rawApiKey) {
    try {
      const keyHash = crypto.createHash("sha256").update(rawApiKey.trim()).digest("hex");
      const apiKeyDoc = await ApiKey.findOne({ keyHash });

      if (!apiKeyDoc) {
        return res.status(401).json({ message: "Invalid API key" });
      }

      if (apiKeyDoc.status !== "active") {
        return res.status(401).json({ message: "API key has been revoked" });
      }

      if (apiKeyDoc.expiresAt && new Date(apiKeyDoc.expiresAt) < new Date()) {
        return res.status(401).json({ message: "API key has expired" });
      }

      // Update lastUsedAt asynchronously
      ApiKey.findByIdAndUpdate(apiKeyDoc._id, { lastUsedAt: new Date() }).exec();

      req.apiKey = apiKeyDoc;
      req.workspaceId = apiKeyDoc.workspaceId;
      req.user = {
        _id: apiKeyDoc.createdBy,
        isApiKey: true,
        scopes: apiKeyDoc.scopes || [],
      };

      return next();
    } catch (err) {
      return res.status(500).json({ message: "API key authentication failure" });
    }
  }

  // 2. Fall back to standard JWT auth
  const { authRequired } = await import("./authMiddleware.js");
  return authRequired(req, res, next);
};

/**
 * Middleware guarding endpoints by requiring specific API key scopes.
 * If request is authenticated via standard user JWT, scope check passes automatically.
 *
 * @param {string} requiredScope - Scope required (e.g., "read:tasks", "write:tasks")
 */
export const requireScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      // User JWT authenticated - permitted
      return next();
    }

    const scopes = req.apiKey.scopes || [];
    if (scopes.includes("*") || scopes.includes(requiredScope)) {
      return next();
    }

    return res.status(403).json({
      message: `Insufficient permissions: missing '${requiredScope}' scope`,
    });
  };
};

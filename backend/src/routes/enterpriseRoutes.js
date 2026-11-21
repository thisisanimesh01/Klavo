import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createOrganization,
  getOrganizationDetails,
  updateOrganizationPolicies,
  configureOrganizationSso,
  handleSamlAcsCallback,
  createCustomRole,
  getCustomRolesByWorkspace,
  getAuditLogs,
  verifyAuditChainIntegrity,
} from "../controllers/enterpriseController.js";

const router = express.Router();

// Public SAML ACS callback endpoint (authenticates external IdP assertions)
router.post("/sso/saml/acs", handleSamlAcsCallback);

// Protected enterprise management endpoints
router.use(authRequired);

// Organization management
router.post("/organizations", createOrganization);
router.get("/organizations/:orgId", getOrganizationDetails);
router.put("/organizations/:orgId/policies", updateOrganizationPolicies);
router.put("/organizations/:orgId/sso", configureOrganizationSso);

// Granular Role Management
router.post("/roles", createCustomRole);
router.get("/roles/workspace/:workspaceId", getCustomRolesByWorkspace);

// Centralized Audit Logging
router.get("/audit/logs", getAuditLogs);
router.post("/audit/verify", verifyAuditChainIntegrity);

export default router;

import Organization from "../models/Organization.js";
import { Team } from "../models/Team.js";
import { User } from "../models/User.js";
import CustomRole from "../models/CustomRole.js";
import AuditEvent from "../models/AuditEvent.js";
import { auditService } from "../services/auditService.js";
import { enterpriseSsoService } from "../services/enterpriseSsoService.js";
import { checkTeamAccess, resolveWorkspaceRole } from "../utils/authHelpers.js";

// Helper to check organization-level administrative access
const checkOrgAdmin = async (orgId, userId) => {
  const org = await Organization.findById(orgId);
  if (!org) return { isOrgAdmin: false, org: null };

  const isOwner = org.ownerId.toString() === userId.toString();
  // Also check if user is an owner/admin of any attached workspace
  const matchingTeam = await Team.findOne({
    _id: { $in: org.workspaces },
    $or: [{ owner: userId }, { "memberRoles.userId": userId }],
  });

  const isTeamAdmin = matchingTeam
    ? ["owner", "admin"].includes(resolveWorkspaceRole(matchingTeam, userId))
    : false;

  return {
    isOrgAdmin: isOwner || isTeamAdmin,
    isOwner,
    org,
  };
};

/**
 * Creates an enterprise organization hierarchy node.
 */
export const createOrganization = async (req, res) => {
  try {
    const { name, slug, workspaceIds = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Organization name is required" });
    }

    const cleanSlug = (slug || name).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    const existing = await Organization.findOne({ slug: cleanSlug });
    if (existing) {
      return res.status(400).json({ message: `Organization slug "${cleanSlug}" already in use` });
    }

    const org = await Organization.create({
      name: name.trim(),
      slug: cleanSlug,
      ownerId: req.user._id,
      workspaces: workspaceIds,
    });

    if (workspaceIds.length > 0) {
      await Team.updateMany(
        { _id: { $in: workspaceIds } },
        { $set: { organizationId: org._id } }
      );
    }

    await auditService.recordEvent({
      organizationId: org._id,
      actorId: req.user._id,
      actorEmail: req.user.email,
      actorRole: "owner",
      action: "organization.created",
      targetType: "organization",
      targetId: org._id.toString(),
      details: { name: org.name, slug: org.slug, initialWorkspaces: workspaceIds.length },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "",
    });

    res.status(201).json(org);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves organization details with attached workspaces and current policies.
 */
export const getOrganizationDetails = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { isOrgAdmin, org } = await checkOrgAdmin(orgId, req.user._id);

    if (!org) return res.status(404).json({ message: "Organization not found" });
    if (!isOrgAdmin) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view this organization" });
    }

    const populated = await Organization.findById(orgId)
      .populate("ownerId", "name email avatar")
      .populate("workspaces", "name description logo memberRoles members");

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates organization security policies (domain restrictions, session max age, invite policies).
 */
export const updateOrganizationPolicies = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { policies } = req.body;

    const { isOrgAdmin, org } = await checkOrgAdmin(orgId, req.user._id);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    if (!isOrgAdmin) {
      return res.status(403).json({ message: "Forbidden: Only organization admins can update security policies" });
    }

    if (policies) {
      org.policies = {
        ...org.policies.toObject(),
        ...policies,
      };
      await org.save();

      await auditService.recordEvent({
        organizationId: org._id,
        actorId: req.user._id,
        actorEmail: req.user.email,
        actorRole: "admin",
        action: "organization.policies_updated",
        targetType: "policy",
        targetId: org._id.toString(),
        details: { updatedPolicies: policies },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || "",
      });
    }

    res.json(org);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Configures enterprise SSO (SAML 2.0 / OIDC).
 */
export const configureOrganizationSso = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { ssoConfig } = req.body;

    const { isOrgAdmin, org } = await checkOrgAdmin(orgId, req.user._id);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    if (!isOrgAdmin) {
      return res.status(403).json({ message: "Forbidden: Only organization admins can configure SSO" });
    }

    if (ssoConfig) {
      org.ssoConfig = {
        ...org.ssoConfig.toObject(),
        ...ssoConfig,
      };
      await org.save();

      await auditService.recordEvent({
        organizationId: org._id,
        actorId: req.user._id,
        actorEmail: req.user.email,
        actorRole: "admin",
        action: "organization.sso_configured",
        targetType: "sso",
        targetId: org._id.toString(),
        details: { provider: ssoConfig.provider, enabled: ssoConfig.enabled, enforceSsoLogin: ssoConfig.enforceSsoLogin },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || "",
      });
    }

    res.json(org);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Processes SAML 2.0 Assertion Consumer Service (ACS) login callback.
 */
export const handleSamlAcsCallback = async (req, res) => {
  try {
    const { SAMLResponse, organizationSlug } = req.body;
    const slug = organizationSlug || req.query.org;

    const result = await enterpriseSsoService.processSamlResponse({
      samlResponseBase64: SAMLResponse,
      organizationSlug: slug,
    });

    await auditService.recordEvent({
      organizationId: result.organization._id,
      actorId: result.user._id,
      actorEmail: result.user.email,
      actorRole: "member",
      action: "user.sso_login_saml",
      targetType: "user",
      targetId: result.user._id.toString(),
      details: { organizationSlug: slug },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "",
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Creates a granular custom role for a workspace.
 */
export const createCustomRole = async (req, res) => {
  try {
    const { workspaceId, name, description, permissions } = req.body;

    const { isAdmin, team } = await checkTeamAccess(workspaceId, req.user._id);
    if (!team) return res.status(404).json({ message: "Workspace not found" });
    if (!isAdmin) {
      return res.status(403).json({ message: "Forbidden: Only workspace admins can create custom roles" });
    }

    const role = await CustomRole.create({
      workspaceId,
      name: name.trim(),
      description: description || "",
      permissions: permissions || {},
      createdBy: req.user._id,
    });

    await auditService.recordEvent({
      workspaceId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      actorRole: "admin",
      action: "role.created",
      targetType: "role",
      targetId: role._id.toString(),
      details: { name: role.name, permissions: role.permissions },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent") || "",
    });

    res.status(201).json(role);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves custom roles for a workspace.
 */
export const getCustomRolesByWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { isMember } = await checkTeamAccess(workspaceId, req.user._id);
    if (!isMember) {
      return res.status(403).json({ message: "Forbidden: You are not a member of this workspace" });
    }

    const roles = await CustomRole.find({ workspaceId }).sort({ createdAt: -1 });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves audit logs for a workspace or organization.
 */
export const getAuditLogs = async (req, res) => {
  try {
    const { workspaceId } = req.query;
    const { orgId } = req.query;
    const limit = Number(req.query.limit) || 50;

    if (workspaceId) {
      const { isAdmin } = await checkTeamAccess(workspaceId, req.user._id);
      if (!isAdmin) {
        return res.status(403).json({ message: "Forbidden: Only workspace admins can view audit logs" });
      }
      const logs = await AuditEvent.find({ workspaceId }).sort({ sequence: -1 }).limit(limit);
      return res.json(logs);
    }

    if (orgId) {
      const { isOrgAdmin } = await checkOrgAdmin(orgId, req.user._id);
      if (!isOrgAdmin) {
        return res.status(403).json({ message: "Forbidden: Only organization admins can view audit logs" });
      }
      const logs = await AuditEvent.find({ organizationId: orgId }).sort({ sequence: -1 }).limit(limit);
      return res.json(logs);
    }

    return res.status(400).json({ message: "Either workspaceId or orgId is required" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Verifies cryptographic integrity of audit event log sequence chain.
 */
export const verifyAuditChainIntegrity = async (req, res) => {
  try {
    const { workspaceId, orgId } = req.body;
    const query = {};
    if (workspaceId) query.workspaceId = workspaceId;
    if (orgId) query.organizationId = orgId;

    const verification = await auditService.verifyChainIntegrity(query);
    res.json({
      success: true,
      verification,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

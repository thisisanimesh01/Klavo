import Document from "../models/Document.js";
import { checkProjectAccess } from "./authHelpers.js";

/**
 * Valid document roles and hierarchy
 */
export const DOCUMENT_ROLES = ["owner", "editor", "commenter", "viewer"];

export const ROLE_HIERARCHY = {
  owner: 4,
  editor: 3,
  commenter: 2,
  viewer: 1,
  none: 0,
};

/**
 * Resolves the effective document role and permissions for a user.
 *
 * Rules:
 * 1. Team Owner or Document Creator -> "owner"
 * 2. Explicit direct share grant on the document (`document.shares`) -> granted role
 * 3. Fallback to default team/project role:
 *    - Team Member -> document.defaultAccess (default: "editor")
 * 4. Outside project team -> "none" (no access)
 *
 * @param {object|string} documentOrId - Document instance or documentId
 * @param {string|ObjectId} userId
 * @returns {Promise<{
 *   hasAccess: boolean,
 *   role: "owner"|"editor"|"commenter"|"viewer"|"none",
 *   canRead: boolean,
 *   canComment: boolean,
 *   canEdit: boolean,
 *   canManagePermissions: boolean,
 *   canDelete: boolean,
 *   document: object|null
 * }>}
 */
export const resolveDocumentAccess = async (documentOrId, userId) => {
  if (!userId) {
    return {
      hasAccess: false,
      role: "none",
      canRead: false,
      canComment: false,
      canEdit: false,
      canManagePermissions: false,
      canDelete: false,
      document: null,
    };
  }

  let doc = documentOrId;
  if (!doc || typeof doc !== "object" || !doc.projectId) {
    doc = await Document.findById(documentOrId);
  }

  if (!doc) {
    return {
      hasAccess: false,
      role: "none",
      canRead: false,
      canComment: false,
      canEdit: false,
      canManagePermissions: false,
      canDelete: false,
      document: null,
    };
  }

  const userIdStr = userId.toString();
  const createdByStr = doc.createdBy?.toString();

  // Check project & team access
  const { hasAccess: hasProjectAccess, isOwner: isTeamOwner } = await checkProjectAccess(
    doc.projectId,
    userId
  );

  // If completely outside the project team, no access
  if (!hasProjectAccess) {
    return {
      hasAccess: false,
      role: "none",
      canRead: false,
      canComment: false,
      canEdit: false,
      canManagePermissions: false,
      canDelete: false,
      document: doc,
    };
  }

  // 1. Team Owner or Document Creator is the Document Owner
  if (isTeamOwner || createdByStr === userIdStr) {
    return {
      hasAccess: true,
      role: "owner",
      canRead: true,
      canComment: true,
      canEdit: true,
      canManagePermissions: true,
      canDelete: true,
      document: doc,
    };
  }

  // 2. Explicit direct share grant on this document
  let effectiveRole = null;
  if (Array.isArray(doc.shares)) {
    const directShare = doc.shares.find((s) => s.userId?.toString() === userIdStr);
    if (directShare && DOCUMENT_ROLES.includes(directShare.role)) {
      effectiveRole = directShare.role;
    }
  }

  // 3. Fallback to inherited project defaultAccess
  if (!effectiveRole) {
    effectiveRole = doc.defaultAccess || "editor";
  }

  const roleWeight = ROLE_HIERARCHY[effectiveRole] || 0;

  return {
    hasAccess: roleWeight >= 1,
    role: effectiveRole,
    canRead: roleWeight >= 1,
    canComment: roleWeight >= 2,
    canEdit: roleWeight >= 3,
    canManagePermissions: roleWeight >= 4,
    canDelete: roleWeight >= 4,
    document: doc,
  };
};

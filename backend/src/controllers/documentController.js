import Document from "../models/Document.js";
import DocumentFolder from "../models/DocumentFolder.js";
import { User } from "../models/User.js";
import { Team } from "../models/Team.js";
import { checkProjectAccess } from "../utils/authHelpers.js";
import { resolveDocumentAccess, DOCUMENT_ROLES } from "../utils/documentPermissions.js";
import { logActivity } from "./activityController.js";
import {
  sanitizeDocumentHtml,
  sanitizeDocumentJson,
  extractPlainTextExcerpt,
} from "../utils/documentSanitizer.js";

/**
 * Creates a new document within a project and optional folder.
 */
export const createDocument = async (req, res) => {
  try {
    const { title, content, contentHtml, projectId, folderId, defaultAccess } = req.body;

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to create documents in this project",
      });
    }

    // Validate folder if specified
    let safeFolderId = null;
    if (folderId && folderId !== "null" && folderId !== "root") {
      const folder = await DocumentFolder.findOne({ _id: folderId, projectId });
      if (!folder) {
        return res.status(400).json({
          message: "Folder not found or belongs to a different project",
        });
      }
      safeFolderId = folder._id;
    }

    const safeTitle = (title && title.trim()) || "Untitled Document";
    const safeHtml = sanitizeDocumentHtml(contentHtml || "<p></p>");
    const safeJson = sanitizeDocumentJson(content);
    const excerpt = extractPlainTextExcerpt(safeHtml);

    const safeDefaultAccess = DOCUMENT_ROLES.includes(defaultAccess) ? defaultAccess : "editor";

    const doc = await Document.create({
      title: safeTitle,
      content: safeJson,
      contentHtml: safeHtml,
      description: excerpt,
      folderId: safeFolderId,
      projectId,
      teamId: project.teamId,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id,
      defaultAccess: safeDefaultAccess,
      shares: [],
    });

    await doc.populate("createdBy", "name email avatar");
    await doc.populate("lastUpdatedBy", "name email avatar");
    if (doc.folderId) {
      await doc.populate("folderId", "name color icon");
    }

    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Created Document",
      message: `${req.user.name} created document "${safeTitle}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("documentCreated", doc);
      io.to(`project_${projectId}`).emit("activityCreated", {
        projectId,
        user: { name: req.user.name },
        action: "Created Document",
        message: `${req.user.name} created document "${safeTitle}"`,
        createdAt: new Date(),
      });
    }

    const docObj = doc.toObject();
    docObj.userPermission = {
      role: "owner",
      canRead: true,
      canComment: true,
      canEdit: true,
      canManagePermissions: true,
      canDelete: true,
    };

    res.status(201).json(docObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves all documents for a project, with optional folderId, search, and sort filtering.
 */
export const getDocumentsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { search, folderId, sortBy, sortOrder } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view documents in this project",
      });
    }

    const query = { projectId, isArchived: false };

    // Folder filtering:
    // "all": return all project documents across all folders
    // "root" / "null": return unfiled/root documents only
    // ":folderId": return documents within that folder
    if (folderId !== undefined && folderId !== "all") {
      if (folderId === "root" || folderId === "null" || folderId === "") {
        query.folderId = null;
      } else {
        query.folderId = folderId;
      }
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [{ title: regex }, { description: regex }];
    }

    // Configurable sorting
    let sort = { updatedAt: -1 };
    if (sortBy) {
      const order = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "title") sort = { title: order };
      else if (sortBy === "createdAt") sort = { createdAt: order };
      else if (sortBy === "updatedAt") sort = { updatedAt: order };
    }

    const documents = await Document.find(query)
      .populate("createdBy", "name email avatar")
      .populate("lastUpdatedBy", "name email avatar")
      .populate("folderId", "name color icon")
      .populate("shares.userId", "name email avatar")
      .sort(sort);

    // Compute effective permission for current user on each document
    const docsWithPermissions = await Promise.all(
      documents.map(async (d) => {
        const perm = await resolveDocumentAccess(d, req.user._id);
        const obj = d.toObject();
        obj.userPermission = perm;
        return obj;
      })
    );

    // Filter out any documents where current user does not have at least read permission
    const accessibleDocs = docsWithPermissions.filter((d) => d.userPermission.canRead);

    res.json(accessibleDocs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves a single document by ID with permission resolution.
 */
export const getDocumentById = async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await Document.findById(documentId)
      .populate("createdBy", "name email avatar")
      .populate("lastUpdatedBy", "name email avatar")
      .populate("folderId", "name color icon")
      .populate("shares.userId", "name email avatar");

    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canRead) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission to view this document",
      });
    }

    const docObj = doc.toObject();
    docObj.userPermission = perm;

    res.json(docObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates an existing document (content, title, folder move, cross-project transfer).
 * Requires Editor or Owner role.
 */
export const updateDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { title, content, contentHtml, folderId, targetProjectId, defaultAccess } = req.body;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canEdit) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission to edit this document",
      });
    }

    // Moving document to a different project requires managePermissions/Owner role
    if (targetProjectId && targetProjectId.toString() !== doc.projectId.toString()) {
      if (!perm.canManagePermissions) {
        return res.status(403).json({
          message: "Forbidden: Only document owners can move documents between projects",
        });
      }

      const targetAccess = await checkProjectAccess(targetProjectId, req.user._id);
      if (!targetAccess.hasAccess || !targetAccess.project) {
        return res.status(403).json({
          message: "Forbidden: You are not authorized to move documents to the target project",
        });
      }
      doc.projectId = targetProjectId;
      doc.teamId = targetAccess.project.teamId;
      doc.folderId = null; // Reset folder on cross-project move
      doc.shares = []; // Clear direct shares on cross-project transfer to prevent cross-tenant leakage
    }

    // Moving document to a different folder within the same project
    if (folderId !== undefined) {
      if (folderId === "root" || folderId === "null" || folderId === null || folderId === "") {
        doc.folderId = null;
      } else {
        const targetFolder = await DocumentFolder.findOne({
          _id: folderId,
          projectId: doc.projectId,
        });
        if (!targetFolder) {
          return res.status(400).json({
            message: "Target folder not found or belongs to a different project",
          });
        }
        doc.folderId = targetFolder._id;
      }
    }

    if (defaultAccess && perm.canManagePermissions && DOCUMENT_ROLES.includes(defaultAccess)) {
      doc.defaultAccess = defaultAccess;
    }

    if (title && title.trim()) {
      doc.title = title.trim();
    }

    if (content !== undefined) {
      doc.content = sanitizeDocumentJson(content);
    }

    if (contentHtml !== undefined) {
      doc.contentHtml = sanitizeDocumentHtml(contentHtml);
      doc.description = extractPlainTextExcerpt(doc.contentHtml);
    }

    doc.lastUpdatedBy = req.user._id;
    await doc.save();

    await doc.populate("createdBy", "name email avatar");
    await doc.populate("lastUpdatedBy", "name email avatar");
    if (doc.folderId) {
      await doc.populate("folderId", "name color icon");
    }
    await doc.populate("shares.userId", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${doc.projectId}`).emit("documentUpdated", doc);
    }

    const docObj = doc.toObject();
    docObj.userPermission = await resolveDocumentAccess(doc, req.user._id);

    res.json(docObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Grants or updates direct document-level permissions to a team member.
 * Requires Owner role on the document.
 */
export const shareDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { userId, role, defaultAccess } = req.body;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canManagePermissions) {
      return res.status(403).json({
        message: "Forbidden: Only document owners can manage document permissions",
      });
    }

    // Update inherited default access if provided
    if (defaultAccess && DOCUMENT_ROLES.includes(defaultAccess)) {
      doc.defaultAccess = defaultAccess;
    }

    // If userId and role provided, grant/update direct share
    if (userId) {
      if (!DOCUMENT_ROLES.includes(role)) {
        return res.status(400).json({
          message: `Invalid role. Must be one of: ${DOCUMENT_ROLES.join(", ")}`,
        });
      }

      // Verify target user is an active member of the project team (anti-cross-tenant protection)
      const targetAccess = await checkProjectAccess(doc.projectId, userId);
      if (!targetAccess.hasAccess) {
        return res.status(400).json({
          message: "User does not belong to the project team and cannot be granted document access",
        });
      }

      // If user is the creator or team owner, they are immutable owners
      if (doc.createdBy.toString() === userId.toString()) {
        return res.status(400).json({
          message: "The document creator is already the permanent owner",
        });
      }

      // Update existing share or add new share
      const existingIdx = doc.shares.findIndex((s) => s.userId.toString() === userId.toString());
      if (existingIdx >= 0) {
        doc.shares[existingIdx].role = role;
        doc.shares[existingIdx].grantedBy = req.user._id;
        doc.shares[existingIdx].grantedAt = new Date();
      } else {
        doc.shares.push({
          userId,
          role,
          grantedBy: req.user._id,
          grantedAt: new Date(),
        });
      }
    }

    await doc.save();
    await doc.populate("createdBy", "name email avatar");
    await doc.populate("lastUpdatedBy", "name email avatar");
    await doc.populate("shares.userId", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${doc.projectId}`).emit("documentUpdated", doc);

      // If collaborator was downgraded to viewer or commenter, notify the active room
      if (userId && (role === "viewer" || role === "commenter")) {
        io.to(`doc_collab_${doc._id}`).emit("collabPermissionUpdated", {
          documentId: doc._id,
          userId,
          role,
        });
      }
    }

    const docObj = doc.toObject();
    docObj.userPermission = await resolveDocumentAccess(doc, req.user._id);

    res.json({
      message: "Permissions updated successfully",
      document: docObj,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Revokes direct document-level permissions from a user.
 * Requires Owner role on the document.
 */
export const revokeDocumentShare = async (req, res) => {
  try {
    const { documentId, targetUserId } = req.params;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canManagePermissions) {
      return res.status(403).json({
        message: "Forbidden: Only document owners can revoke permissions",
      });
    }

    if (doc.createdBy.toString() === targetUserId.toString()) {
      return res.status(400).json({
        message: "Cannot revoke permissions from the document creator",
      });
    }

    doc.shares = doc.shares.filter((s) => s.userId.toString() !== targetUserId.toString());
    await doc.save();

    await doc.populate("createdBy", "name email avatar");
    await doc.populate("lastUpdatedBy", "name email avatar");
    await doc.populate("shares.userId", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${doc.projectId}`).emit("documentUpdated", doc);
      io.to(`doc_collab_${doc._id}`).emit("collabPermissionRevoked", {
        documentId: doc._id,
        userId: targetUserId,
      });
    }

    const docObj = doc.toObject();
    docObj.userPermission = await resolveDocumentAccess(doc, req.user._id);

    res.json({
      message: "Share revoked successfully",
      document: docObj,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Transfers document ownership to another project team member.
 * Requires Owner role on the document.
 */
export const transferDocumentOwnership = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return res.status(400).json({ message: "newOwnerId is required" });
    }

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canDelete) {
      // Only full owner can transfer ownership
      return res.status(403).json({
        message: "Forbidden: Only document owners can transfer ownership",
      });
    }

    const targetAccess = await checkProjectAccess(doc.projectId, newOwnerId);
    if (!targetAccess.hasAccess) {
      return res.status(400).json({
        message: "Target user must belong to the project team",
      });
    }

    // Set new creator/owner, and downgrade old creator to editor in shares
    const oldOwnerId = doc.createdBy;
    doc.createdBy = newOwnerId;
    doc.lastUpdatedBy = req.user._id;

    // Remove new owner from shares if present
    doc.shares = doc.shares.filter((s) => s.userId.toString() !== newOwnerId.toString());

    // Add old owner as editor
    if (oldOwnerId.toString() !== newOwnerId.toString()) {
      doc.shares.push({
        userId: oldOwnerId,
        role: "editor",
        grantedBy: req.user._id,
        grantedAt: new Date(),
      });
    }

    await doc.save();
    await doc.populate("createdBy", "name email avatar");
    await doc.populate("lastUpdatedBy", "name email avatar");
    await doc.populate("shares.userId", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${doc.projectId}`).emit("documentUpdated", doc);
    }

    const docObj = doc.toObject();
    docObj.userPermission = await resolveDocumentAccess(doc, req.user._id);

    res.json({
      message: "Document ownership transferred successfully",
      document: docObj,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Archives or permanently deletes a document.
 * Requires Owner role on the document.
 */
export const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canDelete) {
      return res.status(403).json({
        message: "Forbidden: Only document owners or team owners can delete this document",
      });
    }

    const projectId = doc.projectId;
    await doc.deleteOne();

    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Deleted Document",
      message: `${req.user.name} deleted document "${doc.title}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("documentDeleted", { documentId });
      // Evict any connected sockets from collaborative room
      io.to(`doc_collab_${documentId}`).emit("collabDocumentDeleted", { documentId });
    }

    res.json({ message: "Document deleted successfully", documentId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

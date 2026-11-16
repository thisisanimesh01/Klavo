import Document from "../models/Document.js";
import { checkProjectAccess } from "../utils/authHelpers.js";
import { logActivity } from "./activityController.js";
import {
  sanitizeDocumentHtml,
  sanitizeDocumentJson,
  extractPlainTextExcerpt,
} from "../utils/documentSanitizer.js";

/**
 * Creates a new document within a project.
 */
export const createDocument = async (req, res) => {
  try {
    const { title, content, contentHtml, projectId } = req.body;

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

    const safeTitle = (title && title.trim()) || "Untitled Document";
    const safeHtml = sanitizeDocumentHtml(contentHtml || "<p></p>");
    const safeJson = sanitizeDocumentJson(content);
    const excerpt = extractPlainTextExcerpt(safeHtml);

    const doc = await Document.create({
      title: safeTitle,
      content: safeJson,
      contentHtml: safeHtml,
      description: excerpt,
      projectId,
      teamId: project.teamId,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id,
    });

    await doc.populate("createdBy", "name email avatar");
    await doc.populate("lastUpdatedBy", "name email avatar");

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

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves all documents for a project.
 */
export const getDocumentsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { search } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view documents in this project",
      });
    }

    const query = { projectId, isArchived: false };
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [{ title: regex }, { description: regex }];
    }

    const documents = await Document.find(query)
      .populate("createdBy", "name email avatar")
      .populate("lastUpdatedBy", "name email avatar")
      .sort({ updatedAt: -1 });

    res.json(documents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves a single document by ID.
 */
export const getDocumentById = async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await Document.findById(documentId)
      .populate("createdBy", "name email avatar")
      .populate("lastUpdatedBy", "name email avatar");

    if (!doc) return res.status(404).json({ message: "Document not found" });

    const { hasAccess } = await checkProjectAccess(doc.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view this document",
      });
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates an existing document (content, title, or HTML snapshot).
 */
export const updateDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { title, content, contentHtml } = req.body;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const { hasAccess } = await checkProjectAccess(doc.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to update this document",
      });
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

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${doc.projectId}`).emit("documentUpdated", doc);
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Archives or permanently deletes a document.
 */
export const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const { hasAccess, isOwner } = await checkProjectAccess(doc.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to delete this document",
      });
    }

    const isCreator = doc.createdBy.toString() === req.user._id.toString();
    if (!isCreator && !isOwner) {
      return res.status(403).json({
        message: "Forbidden: Only the document creator or team owner can delete this document",
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
    }

    res.json({ message: "Document deleted successfully", documentId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

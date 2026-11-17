import Task from "../models/Task.js";
import Document from "../models/Document.js";
import { checkProjectAccess, checkTaskAccess } from "../utils/authHelpers.js";
import { resolveDocumentAccess } from "../utils/documentPermissions.js";
import { logActivity } from "./activityController.js";

/**
 * Links a Document or Wiki Page to a Task (DOC-08).
 * Enforces:
 * - User must have project/task access.
 * - User must have at least read permission on the document.
 * - Strict project isolation: Task and Document must belong to the exact same projectId.
 * - Idempotency: Duplicate linking requests are gracefully handled.
 */
export const linkDocumentToTask = async (req, res) => {
  try {
    const { taskId, documentId } = req.params;

    const { hasAccess: hasTaskAccess, task, project } = await checkTaskAccess(
      taskId,
      req.user._id
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!hasTaskAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to modify tasks in this project",
      });
    }

    const doc = await Document.findById(documentId);
    if (!doc || doc.isArchived) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Strict same-project isolation
    if (doc.projectId.toString() !== task.projectId.toString()) {
      return res.status(400).json({
        message:
          "Project boundary violation: Task and Document must belong to the same project",
      });
    }

    // Document permission check: User must be able to view the document to link it
    const docPerm = await resolveDocumentAccess(doc, req.user._id);
    if (!docPerm.canRead) {
      return res.status(403).json({
        message:
          "Forbidden: You do not have permission to view this document and cannot link it",
      });
    }

    // Bi-directional link updates
    const taskAlreadyLinked = task.linkedDocuments?.some(
      (dId) => dId.toString() === doc._id.toString()
    );
    const docAlreadyLinked = doc.linkedTasks?.some(
      (tId) => tId.toString() === task._id.toString()
    );

    if (!taskAlreadyLinked) {
      if (!Array.isArray(task.linkedDocuments)) task.linkedDocuments = [];
      task.linkedDocuments.push(doc._id);
      await task.save();
    }

    if (!docAlreadyLinked) {
      if (!Array.isArray(doc.linkedTasks)) doc.linkedTasks = [];
      doc.linkedTasks.push(task._id);
      await doc.save();
    }

    await logActivity({
      projectId: task.projectId,
      userId: req.user._id,
      action: "Linked Document",
      message: `${req.user.name} linked document "${doc.title}" to task "${task.title}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${task.projectId}`).emit("taskUpdated", task);
      io.to(`project_${task.projectId}`).emit("documentUpdated", doc);
      io.to(`doc_collab_${doc._id}`).emit("documentTaskLinked", {
        documentId: doc._id,
        taskId: task._id,
      });
    }

    res.json({
      message: "Document linked to task successfully",
      taskId: task._id,
      documentId: doc._id,
      isWiki: Boolean(doc.isWiki),
      docTitle: doc.title,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Unlinks a Document from a Task (DOC-08).
 * Enforces same-project access check and bi-directional removal.
 */
export const unlinkDocumentFromTask = async (req, res) => {
  try {
    const { taskId, documentId } = req.params;

    const { hasAccess: hasTaskAccess, task } = await checkTaskAccess(
      taskId,
      req.user._id
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!hasTaskAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to modify tasks in this project",
      });
    }

    // Bi-directional unlink
    await Task.updateOne(
      { _id: taskId },
      { $pull: { linkedDocuments: documentId } }
    );

    const doc = await Document.findById(documentId);
    if (doc) {
      await Document.updateOne(
        { _id: documentId },
        { $pull: { linkedTasks: taskId } }
      );
    }

    await logActivity({
      projectId: task.projectId,
      userId: req.user._id,
      action: "Unlinked Document",
      message: `${req.user.name} unlinked document from task "${task.title}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${task.projectId}`).emit("taskUpdated", {
        ...task.toObject(),
        linkedDocuments: (task.linkedDocuments || []).filter(
          (d) => d.toString() !== documentId.toString()
        ),
      });
      if (doc) {
        io.to(`project_${task.projectId}`).emit("documentUpdated", {
          ...doc.toObject(),
          linkedTasks: (doc.linkedTasks || []).filter(
            (t) => t.toString() !== taskId.toString()
          ),
        });
      }
    }

    res.json({
      message: "Document unlinked from task successfully",
      taskId,
      documentId,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves all Documents linked to a specific Task.
 * Filters out documents the user cannot read and includes document permissions.
 */
export const getTaskLinkedDocuments = async (req, res) => {
  try {
    const { taskId } = req.params;

    const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view this task",
      });
    }

    const docIds = task.linkedDocuments || [];
    if (docIds.length === 0) {
      return res.json([]);
    }

    const docs = await Document.find({
      _id: { $in: docIds },
      isArchived: false,
    })
      .populate("createdBy", "name email avatar")
      .populate("lastUpdatedBy", "name email avatar")
      .populate("folderId", "name color icon")
      .populate("parentWikiId", "title isWikiHome wikiSlug")
      .sort({ updatedAt: -1 });

    // Filter by effective read permissions
    const accessibleDocs = [];
    for (const doc of docs) {
      const perm = await resolveDocumentAccess(doc, req.user._id);
      if (perm.canRead) {
        const obj = doc.toObject();
        obj.userPermission = perm;
        accessibleDocs.push(obj);
      }
    }

    res.json(accessibleDocs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves all Tasks linked to a specific Document (Reverse Navigation).
 * Enforces document-level read permission.
 */
export const getDocumentLinkedTasks = async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await Document.findById(documentId);
    if (!doc || doc.isArchived) {
      return res.status(404).json({ message: "Document not found" });
    }

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canRead) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission to view this document",
      });
    }

    const taskIds = doc.linkedTasks || [];
    if (taskIds.length === 0) {
      return res.json([]);
    }

    const tasks = await Task.find({
      _id: { $in: taskIds },
    })
      .populate("assignedTo", "name email avatar")
      .populate("sprintId", "name status")
      .populate("milestoneId", "name")
      .sort({ updatedAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves all documents for a project that have at least one linked task (Project Overview).
 */
export const getProjectLinkedDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view documents in this project",
      });
    }

    const docs = await Document.find({
      projectId,
      isArchived: false,
      linkedTasks: { $exists: true, $not: { $size: 0 } },
    })
      .populate("linkedTasks", "title status priority")
      .populate("createdBy", "name email avatar")
      .populate("lastUpdatedBy", "name email avatar")
      .sort({ updatedAt: -1 });

    const accessibleDocs = [];
    for (const doc of docs) {
      const perm = await resolveDocumentAccess(doc, req.user._id);
      if (perm.canRead) {
        const obj = doc.toObject();
        obj.userPermission = perm;
        accessibleDocs.push(obj);
      }
    }

    res.json(accessibleDocs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

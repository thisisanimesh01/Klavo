import Document from "../models/Document.js";
import DocumentVersion from "../models/DocumentVersion.js";
import { resolveDocumentAccess } from "../utils/documentPermissions.js";
import {
  createDocumentVersionSnapshot,
  computeTextDiff,
} from "../utils/versionHelpers.js";
import { sanitizeDocumentHtml, sanitizeDocumentJson } from "../utils/documentSanitizer.js";
import { activeDocRooms } from "../sockets/documents.js";
import * as Y from "yjs";

// In-memory per-document restoration mutex to serialize simultaneous restores
const restoreLocks = new Map();

/**
 * Creates a manual named snapshot of a document.
 * Requires: Editor or Owner role.
 */
export const createNamedSnapshot = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { name, changeSummary } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Snapshot name is required" });
    }

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canEdit) {
      return res.status(403).json({
        message: "Forbidden: You must be an Editor or Owner to create a version snapshot",
      });
    }

    const version = await createDocumentVersionSnapshot({
      documentId: doc._id,
      projectId: doc.projectId,
      title: doc.title,
      content: doc.content,
      contentHtml: doc.contentHtml,
      description: doc.description,
      yjsUpdate: doc.yjsUpdate,
      authorId: req.user._id,
      isNamedSnapshot: true,
      snapshotName: name.trim(),
      changeSummary: (changeSummary && changeSummary.trim()) || "Manual named snapshot",
      force: true, // Force creation even if identical content hash
    });

    if (!version) {
      return res.status(500).json({ message: "Failed to record version snapshot" });
    }

    const populated = await DocumentVersion.findById(version._id)
      .populate("authorId", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`doc_collab_${documentId}`).emit("docVersionCreated", populated);
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves chronological revision history for a document.
 * Requires: Viewer, Commenter, Editor, or Owner.
 */
export const getDocumentVersions = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canRead) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this document" });
    }

    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [versions, totalCount] = await Promise.all([
      DocumentVersion.find({ documentId })
        .populate("authorId", "name email avatar")
        .sort({ revisionNumber: -1 })
        .skip(skip)
        .limit(parsedLimit),
      DocumentVersion.countDocuments({ documentId }),
    ]);

    res.json({
      versions,
      totalCount,
      page: parsedPage,
      totalPages: Math.ceil(totalCount / parsedLimit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves a single version snapshot by ID.
 * Requires: Viewer, Commenter, Editor, or Owner.
 */
export const getDocumentVersionById = async (req, res) => {
  try {
    const { documentId, versionId } = req.params;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canRead) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this document" });
    }

    const version = await DocumentVersion.findOne({ _id: versionId, documentId })
      .populate("authorId", "name email avatar");

    if (!version) return res.status(404).json({ message: "Version snapshot not found" });

    res.json(version);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Compares two versions or compares a version against the current document.
 * Returns word/token level diff and metadata.
 */
export const compareDocumentVersions = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { sourceVersionId, targetVersionId } = req.query;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canRead) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this document" });
    }

    let sourceVersion = null;
    let targetVersion = null;

    if (sourceVersionId) {
      sourceVersion = await DocumentVersion.findOne({ _id: sourceVersionId, documentId });
      if (!sourceVersion) return res.status(404).json({ message: "Source version not found" });
    }

    if (targetVersionId) {
      targetVersion = await DocumentVersion.findOne({ _id: targetVersionId, documentId });
      if (!targetVersion) return res.status(404).json({ message: "Target version not found" });
    }

    const sourceHtml = sourceVersion ? sourceVersion.contentHtml : "";
    const targetHtml = targetVersion ? targetVersion.contentHtml : doc.contentHtml;

    const diff = computeTextDiff(sourceHtml, targetHtml);

    res.json({
      documentId,
      source: sourceVersion || { revisionNumber: 0, title: "Initial Blank" },
      target: targetVersion || { revisionNumber: "Current", title: doc.title },
      diff,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Safely restores a document to a previous revision.
 * Non-destructive: Restoring creates a brand new revision rather than overwriting history.
 *
 * CRITICAL ATOMICITY & YJS RESTORATION PROTOCOL:
 * 1. Mutex serialization: Serializes simultaneous restore requests per documentId.
 * 2. Sanitize restored payload attributes.
 * 3. Update Document persistence in MongoDB.
 * 4. Record new append-only DocumentVersion revision record. If this fails, roll back Document state.
 * 5. Increment restoreEpoch to invalidate any in-flight pre-restore socket updates.
 * 6. Replace active in-memory room Y.Doc cleanly and cancel pending autosaves.
 * 7. Broadcast `docResetState` containing new authoritative epoch, document state, and Yjs vector.
 *
 * Preserves folderId, permissions, shares, comments, and project tenancy.
 * Requires: Editor or Owner role.
 */
export const restoreDocumentVersion = async (req, res) => {
  const { documentId, versionId } = req.params;

  // Serialize restoration per document to prevent race conditions during simultaneous restores
  if (restoreLocks.get(documentId)) {
    return res.status(409).json({ message: "Another restoration is currently in progress for this document" });
  }

  restoreLocks.set(documentId, true);

  try {
    const doc = await Document.findById(documentId);
    if (!doc) {
      restoreLocks.delete(documentId);
      return res.status(404).json({ message: "Document not found" });
    }

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canEdit) {
      restoreLocks.delete(documentId);
      return res.status(403).json({
        message: "Forbidden: You must be an Editor or Owner to restore document versions",
      });
    }

    const versionToRestore = await DocumentVersion.findOne({ _id: versionId, documentId });
    if (!versionToRestore) {
      restoreLocks.delete(documentId);
      return res.status(404).json({ message: "Version snapshot to restore not found" });
    }

    // Capture backup state in case revision creation fails
    const backupState = {
      title: doc.title,
      content: doc.content,
      contentHtml: doc.contentHtml,
      description: doc.description,
      yjsUpdate: doc.yjsUpdate,
      lastUpdatedBy: doc.lastUpdatedBy,
    };

    // 1. Sanitize restored document attributes
    const safeTitle = versionToRestore.title;
    const safeContent = sanitizeDocumentJson(versionToRestore.content);
    const safeContentHtml = sanitizeDocumentHtml(versionToRestore.contentHtml);
    const targetYjsUpdate = versionToRestore.yjsUpdate || null;

    doc.title = safeTitle;
    doc.content = safeContent;
    doc.contentHtml = safeContentHtml;
    doc.description = versionToRestore.description;
    doc.yjsUpdate = targetYjsUpdate;
    doc.lastUpdatedBy = req.user._id;

    await doc.save();

    // 2. Create a NEW revision record for the restoration action (non-destructive append-only)
    let restorationRevision = null;
    try {
      restorationRevision = await createDocumentVersionSnapshot({
        documentId: doc._id,
        projectId: doc.projectId,
        title: doc.title,
        content: doc.content,
        contentHtml: doc.contentHtml,
        description: doc.description,
        yjsUpdate: targetYjsUpdate,
        authorId: req.user._id,
        isNamedSnapshot: false,
        changeSummary: `Restored to Revision #${versionToRestore.revisionNumber} ("${versionToRestore.title}")`,
        force: true, // Non-destructive append
      });

      if (!restorationRevision) {
        throw new Error("Failed to record append-only restoration revision");
      }
    } catch (revisionErr) {
      // Rollback document state in MongoDB if revision record failed to persist
      Object.assign(doc, backupState);
      await doc.save();
      restoreLocks.delete(documentId);
      return res.status(500).json({ message: "Restoration aborted: unable to write revision history", error: revisionErr.message });
    }

    // 3. Atomically synchronize active in-memory Yjs collaboration room with epoch bump
    let freshUpdateBase64 = targetYjsUpdate;
    let newEpoch = 1;
    const activeRoom = activeDocRooms.get(documentId);

    if (activeRoom) {
      // Cancel pending autosave persistence to avoid overwriting restoration with stale queued buffer
      if (activeRoom.debounceTimer) {
        clearTimeout(activeRoom.debounceTimer);
        activeRoom.debounceTimer = null;
      }

      // Bump restoration epoch to invalidate in-flight pre-restore socket updates
      activeRoom.restoreEpoch = (activeRoom.restoreEpoch || 1) + 1;
      newEpoch = activeRoom.restoreEpoch;

      // Re-instantiate room.doc with clean restored state
      const freshYDoc = new Y.Doc();
      if (targetYjsUpdate) {
        try {
          const restoredBinary = Buffer.from(targetYjsUpdate, "base64");
          Y.applyUpdate(freshYDoc, new Uint8Array(restoredBinary));
        } catch (yjsErr) {
          console.error("Failed to apply restored Yjs state to new Doc:", yjsErr);
        }
      }

      // Destroy old doc to free memory and detach listeners
      try {
        activeRoom.doc.destroy();
      } catch (dErr) {
        // Safe destroy fallback
      }

      activeRoom.doc = freshYDoc;
      activeRoom.dirty = false;

      // Encode state as update
      const fullFreshUpdate = Y.encodeStateAsUpdate(freshYDoc);
      freshUpdateBase64 = Buffer.from(fullFreshUpdate).toString("base64");
    }

    await doc.populate("createdBy", "name email avatar");
    await doc.populate("lastUpdatedBy", "name email avatar");
    if (doc.folderId) {
      await doc.populate("folderId", "name color icon");
    }
    await doc.populate("shares.userId", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      // Broadcast project-level document metadata update
      io.to(`project_${doc.projectId}`).emit("documentUpdated", doc);

      // Broadcast authoritative reset event to document collaboration room with new epoch
      io.to(`doc_collab_${documentId}`).emit("docResetState", {
        documentId: doc._id,
        update: freshUpdateBase64,
        epoch: newEpoch,
        restoredVersionId: versionToRestore._id,
        newRevisionNumber: restorationRevision?.revisionNumber,
        doc,
      });

      // Backward-compatible event
      io.to(`doc_collab_${documentId}`).emit("docVersionRestored", {
        documentId: doc._id,
        epoch: newEpoch,
        restoredVersionId: versionToRestore._id,
        newRevisionNumber: restorationRevision?.revisionNumber,
        doc,
      });
    }

    const docObj = doc.toObject();
    docObj.userPermission = perm;

    restoreLocks.delete(documentId);

    res.json({
      message: `Document restored successfully to Revision #${versionToRestore.revisionNumber}`,
      document: docObj,
      restorationRevision,
      epoch: newEpoch,
    });
  } catch (err) {
    restoreLocks.delete(documentId);
    res.status(500).json({ message: err.message });
  }
};

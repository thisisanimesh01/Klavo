import DocumentComment from "../models/DocumentComment.js";
import Document from "../models/Document.js";
import { resolveDocumentAccess } from "../utils/documentPermissions.js";
import { resolveEligibleMentions } from "../utils/mentionHelpers.js";
import { createTargetedNotification } from "../utils/notificationHelpers.js";

/**
 * Creates a new document comment thread or replies to an existing thread.
 * Enforces: Owner, Editor, Commenter can comment; Viewer is denied.
 */
export const createDocumentComment = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { text, parentCommentId, anchor } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Enforce document permissions: Viewer cannot comment
    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canComment) {
      return res.status(403).json({
        message: "Forbidden: You have view-only access and cannot post comments",
      });
    }

    // If replying, verify parent comment exists and belongs to this document
    let safeParentId = null;
    let parentComment = null;
    if (parentCommentId) {
      parentComment = await DocumentComment.findOne({
        _id: parentCommentId,
        documentId,
      });
      if (!parentComment) {
        return res.status(400).json({ message: "Parent comment not found in this document" });
      }
      safeParentId = parentComment._id;
    }

    // Sanitize anchor if present
    let safeAnchor = { selectedText: null, from: null, to: null };
    if (anchor && typeof anchor === "object") {
      safeAnchor = {
        selectedText: anchor.selectedText ? String(anchor.selectedText).slice(0, 500) : null,
        from: Number.isInteger(anchor.from) ? anchor.from : null,
        to: Number.isInteger(anchor.to) ? anchor.to : null,
      };
    }

    // Resolve eligible mentions strictly within project team
    const eligibleMentions = await resolveEligibleMentions(text, doc.projectId);
    const mentionIds = eligibleMentions.map((u) => u._id);

    const comment = await DocumentComment.create({
      documentId,
      projectId: doc.projectId,
      parentCommentId: safeParentId,
      userId: req.user._id,
      text: text.trim(),
      anchor: safeAnchor,
      mentions: mentionIds,
    });

    const populated = await DocumentComment.findById(comment._id)
      .populate("userId", "name email avatar")
      .populate("mentions", "name email avatar")
      .populate("resolvedBy", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      // Broadcast real-time comment creation to document collaboration room
      io.to(`doc_collab_${documentId}`).emit("docCommentAdded", populated);

      const notifiedUsers = new Set();

      // 1. Notify mentioned users
      for (const mUser of eligibleMentions) {
        const mIdStr = mUser._id.toString();
        if (mIdStr !== req.user._id.toString() && !notifiedUsers.has(mIdStr)) {
          notifiedUsers.add(mIdStr);
          await createTargetedNotification(io, {
            userId: mUser._id,
            senderId: req.user._id,
            type: "MENTION",
            message: `${req.user.name} mentioned you in a comment on "${doc.title}": "${text.trim().slice(0, 60)}"`,
            data: { documentId: doc._id, projectId: doc.projectId, commentId: comment._id },
          });
        }
      }

      // 2. If reply, notify parent thread author
      if (parentComment && parentComment.userId) {
        const parentAuthorId = parentComment.userId.toString();
        if (parentAuthorId !== req.user._id.toString() && !notifiedUsers.has(parentAuthorId)) {
          notifiedUsers.add(parentAuthorId);
          await createTargetedNotification(io, {
            userId: parentComment.userId,
            senderId: req.user._id,
            type: "COMMENT_ADDED",
            message: `${req.user.name} replied to your comment on "${doc.title}": "${text.trim().slice(0, 60)}"`,
            data: { documentId: doc._id, projectId: doc.projectId, commentId: comment._id },
          });
        }
      }

      // 3. Notify document creator if not already notified
      const docCreatorId = doc.createdBy.toString();
      if (docCreatorId !== req.user._id.toString() && !notifiedUsers.has(docCreatorId)) {
        notifiedUsers.add(docCreatorId);
        await createTargetedNotification(io, {
          userId: doc.createdBy,
          senderId: req.user._id,
          type: "COMMENT_ADDED",
          message: `${req.user.name} commented on your document "${doc.title}"`,
          data: { documentId: doc._id, projectId: doc.projectId, commentId: comment._id },
        });
      }
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves all comments for a document, grouped into threads with replies.
 * Requires at least Viewer role.
 */
export const getDocumentComments = async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canRead) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this document" });
    }

    // Fetch all comments for document
    const allComments = await DocumentComment.find({ documentId })
      .populate("userId", "name email avatar")
      .populate("mentions", "name email avatar")
      .populate("resolvedBy", "name email avatar")
      .sort({ createdAt: 1 });

    // Group into threads: root comments have an array of replies
    const threadMap = new Map();
    const rootComments = [];

    allComments.forEach((c) => {
      const cObj = c.toObject();
      cObj.replies = [];
      threadMap.set(c._id.toString(), cObj);
    });

    allComments.forEach((c) => {
      const cIdStr = c._id.toString();
      const cObj = threadMap.get(cIdStr);
      if (c.parentCommentId) {
        const parent = threadMap.get(c.parentCommentId.toString());
        if (parent) {
          parent.replies.push(cObj);
        } else {
          rootComments.push(cObj);
        }
      } else {
        rootComments.push(cObj);
      }
    });

    res.json(rootComments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates a comment's text.
 * Requires: Comment Author or Document Owner.
 */
export const updateDocumentComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const comment = await DocumentComment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const doc = await Document.findById(comment.documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    const isAuthor = comment.userId.toString() === req.user._id.toString();

    if (!isAuthor && !perm.canManagePermissions) {
      return res.status(403).json({
        message: "Forbidden: Only the comment author or document owner can edit this comment",
      });
    }

    comment.text = text.trim();
    comment.isEdited = true;

    // Refresh mentions
    const eligibleMentions = await resolveEligibleMentions(text, doc.projectId);
    comment.mentions = eligibleMentions.map((u) => u._id);

    await comment.save();

    const populated = await DocumentComment.findById(comment._id)
      .populate("userId", "name email avatar")
      .populate("mentions", "name email avatar")
      .populate("resolvedBy", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`doc_collab_${comment.documentId}`).emit("docCommentUpdated", populated);
    }

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Resolves or reopens a comment thread.
 * Requires: Commenter, Editor, or Owner.
 */
export const toggleResolveComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { isResolved } = req.body;

    const comment = await DocumentComment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const doc = await Document.findById(comment.documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    if (!perm.canComment) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission to resolve comments",
      });
    }

    const targetResolved = isResolved !== undefined ? Boolean(isResolved) : !comment.isResolved;

    comment.isResolved = targetResolved;
    comment.resolvedBy = targetResolved ? req.user._id : null;
    comment.resolvedAt = targetResolved ? new Date() : null;

    await comment.save();

    const populated = await DocumentComment.findById(comment._id)
      .populate("userId", "name email avatar")
      .populate("mentions", "name email avatar")
      .populate("resolvedBy", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`doc_collab_${comment.documentId}`).emit("docCommentResolved", {
        commentId: comment._id,
        isResolved: targetResolved,
        resolvedBy: populated.resolvedBy,
        resolvedAt: comment.resolvedAt,
      });
    }

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Deletes a comment (and cascadingly deletes its replies if it's a root comment).
 * Requires: Comment Author or Document Owner.
 */
export const deleteDocumentComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await DocumentComment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const doc = await Document.findById(comment.documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const perm = await resolveDocumentAccess(doc, req.user._id);
    const isAuthor = comment.userId.toString() === req.user._id.toString();

    if (!isAuthor && !perm.canManagePermissions) {
      return res.status(403).json({
        message: "Forbidden: Only the comment author or document owner can delete this comment",
      });
    }

    const documentId = comment.documentId;
    const parentCommentId = comment.parentCommentId;

    // Delete comment
    await comment.deleteOne();

    // If it was a root comment, delete all replies
    if (!parentCommentId) {
      await DocumentComment.deleteMany({ parentCommentId: commentId });
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`doc_collab_${documentId}`).emit("docCommentDeleted", {
        commentId,
        parentCommentId,
      });
    }

    res.json({ message: "Comment deleted successfully", commentId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

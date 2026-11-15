import Reaction from "../models/Reaction.js";
import Comment from "../models/Comment.js";
import { checkTaskAccess } from "../utils/authHelpers.js";
import { createTargetedNotification } from "../utils/notificationHelpers.js";

export const addReaction = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { emoji } = req.body;

    if (!emoji || !emoji.trim()) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const { hasAccess, task } = await checkTaskAccess(comment.taskId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to react to this comment" });
    }

    const trimmedEmoji = emoji.trim();

    // Prevent duplicate identical reaction: check if already exists
    const existing = await Reaction.findOne({
      commentId,
      userId: req.user._id,
      emoji: trimmedEmoji,
    });

    if (existing) {
      return res.status(409).json({ message: "Reaction already exists", reaction: existing });
    }

    const reaction = await Reaction.create({
      commentId,
      userId: req.user._id,
      emoji: trimmedEmoji,
    });

    const populatedReaction = await Reaction.findById(reaction._id).populate("userId", "name email");

    const io = req.app.get("io");
    if (io) {
      io.to(`comment_${commentId}`).emit("reactionAdded", populatedReaction);
      if (task) {
        io.to(`project_${task.projectId}`).emit("reactionAdded", populatedReaction);
      }

      // Targeted notification: notify the comment author about the reaction (if not own reaction)
      if (comment.userId) {
        await createTargetedNotification(io, {
          userId: comment.userId,
          senderId: req.user._id,
          type: "REACTION_ADDED",
          message: `${req.user.name} reacted ${trimmedEmoji} to your comment`,
          data: { commentId: comment._id, taskId: comment.taskId, emoji: trimmedEmoji },
        });
      }
    }

    res.status(201).json(populatedReaction);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Reaction already exists" });
    }
    res.status(500).json({ message: err.message });
  }
};

export const getReactions = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const { hasAccess } = await checkTaskAccess(comment.taskId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view reactions for this comment" });
    }

    const reactions = await Reaction.find({ commentId }).populate("userId", "name email");

    res.json(reactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const removeReaction = async (req, res) => {
  try {
    const { commentId, emoji } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const { hasAccess, task } = await checkTaskAccess(comment.taskId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to modify reactions for this comment" });
    }

    const deleted = await Reaction.findOneAndDelete({
      commentId,
      userId: req.user._id,
      emoji: decodeURIComponent(emoji),
    });

    if (!deleted) {
      return res.status(404).json({ message: "Reaction not found" });
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`comment_${commentId}`).emit("reactionRemoved", {
        commentId,
        userId: req.user._id,
        emoji: deleted.emoji,
      });
      if (task) {
        io.to(`project_${task.projectId}`).emit("reactionRemoved", {
          commentId,
          userId: req.user._id,
          emoji: deleted.emoji,
        });
      }
    }

    res.json({ message: "Reaction removed", reaction: deleted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

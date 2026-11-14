import Reaction from "../models/Reaction.js";
import Comment from "../models/Comment.js";
import { checkTaskAccess } from "../utils/authHelpers.js";

export const addReaction = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { emoji } = req.body;

    if (!emoji || !emoji.trim()) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const { hasAccess } = await checkTaskAccess(comment.taskId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to react to this comment" });
    }

    const reaction = await Reaction.create({
      commentId,
      userId: req.user._id,
      emoji: emoji.trim(),
    });

    const io = req.app.get("io");
    if (io) io.to(`comment_${commentId}`).emit("reactionAdded", reaction);

    res.status(201).json(reaction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

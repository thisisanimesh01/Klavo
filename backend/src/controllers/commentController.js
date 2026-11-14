import Comment from "../models/Comment.js";
import Task from "../models/Task.js";
import { checkTaskAccess } from "../utils/authHelpers.js";

export const addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text required to add a comment" });
    }

    const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // IDOR protection: User must be a member of the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to comment on this task" });
    }

    const comment = await Comment.create({
      taskId,
      userId: req.user._id,
      text: text.trim(),
    });

    // Add comment to task reference
    await Task.findByIdAndUpdate(taskId, {
      $push: { comments: comment._id },
    });

    const populatedComment = await Comment.findById(comment._id).populate("userId", "name email avatar");

    // Socket emit to project room
    const io = req.app.get("io");
    if (io) {
      io.to(`project_${task.projectId}`).emit("commentAdded", populatedComment);
    }

    res.status(201).json(populatedComment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getComments = async (req, res) => {
  try {
    const { taskId } = req.params;

    const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // IDOR protection: User must be a member of the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view comments for this task" });
    }

    const comments = await Comment.find({ taskId })
      .populate("userId", "name email avatar")
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

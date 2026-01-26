import Comment from "../models/Comment.js";
import Task from "../models/Task.js";

export const addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;

    if (!text) return res.status(400).json({ message: "Comment text required to add a comment" });

    const comment = await Comment.create({
      taskId,
      userId: req.user._id,
      text,
    });

    // Add comment to task reference
    await Task.findByIdAndUpdate(taskId, {
      $push: { comments: comment._id },
    });

    // Socket emit
    const io = req.app.get("io");
    if (io) io.to(`project_${comment.taskId}`).emit("commentAdded", comment);

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getComments = async (req, res) => {
  try {
    const { taskId } = req.params;

    const comments = await Comment.find({ taskId })
      .populate("userId", "name email avatar")
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

import Comment from "../models/Comment.js";
import Task from "../models/Task.js";
import { User } from "../models/User.js";
import { checkTaskAccess } from "../utils/authHelpers.js";
import { createTargetedNotification } from "../utils/notificationHelpers.js";

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

    const io = req.app.get("io");
    if (io) {
      // Emit to project room and specific comment/task thread room
      io.to(`project_${task.projectId}`).emit("commentAdded", populatedComment);
      io.to(`comment_${taskId}`).emit("commentAdded", populatedComment);

      // Targeted notifications:
      // 1. Notify task assignees about new comment (except comment author)
      const notifiedUserIds = new Set();
      if (Array.isArray(task.assignedTo)) {
        for (const assigneeId of task.assignedTo) {
          const aIdStr = assigneeId.toString();
          if (aIdStr !== req.user._id.toString() && !notifiedUserIds.has(aIdStr)) {
            notifiedUserIds.add(aIdStr);
            await createTargetedNotification(io, {
              userId: assigneeId,
              senderId: req.user._id,
              type: "COMMENT_ADDED",
              message: `${req.user.name} commented on "${task.title}": "${text.trim().slice(0, 50)}"`,
              data: { taskId: task._id, projectId: task.projectId, commentId: comment._id },
            });
          }
        }
      }

      // 2. Notify task creator if not the commenter
      if (task.createdBy) {
        const creatorIdStr = task.createdBy.toString();
        if (creatorIdStr !== req.user._id.toString() && !notifiedUserIds.has(creatorIdStr)) {
          notifiedUserIds.add(creatorIdStr);
          await createTargetedNotification(io, {
            userId: task.createdBy,
            senderId: req.user._id,
            type: "COMMENT_ADDED",
            message: `${req.user.name} commented on your task "${task.title}"`,
            data: { taskId: task._id, projectId: task.projectId, commentId: comment._id },
          });
        }
      }

      // 3. Mentions in comment text (e.g. @bob or @Bob)
      const mentionMatches = text.match(/@(\w+)/g);
      if (mentionMatches) {
        const names = mentionMatches.map((m) => m.slice(1).toLowerCase());
        const mentionedUsers = await User.find({
          name: { $in: names.map((n) => new RegExp(`^${n}$`, "i")) },
        });

        for (const mUser of mentionedUsers) {
          const mUserIdStr = mUser._id.toString();
          if (mUserIdStr !== req.user._id.toString() && !notifiedUserIds.has(mUserIdStr)) {
            notifiedUserIds.add(mUserIdStr);
            await createTargetedNotification(io, {
              userId: mUser._id,
              senderId: req.user._id,
              type: "MENTION",
              message: `${req.user.name} mentioned you in a comment on "${task.title}"`,
              data: { taskId: task._id, projectId: task.projectId, commentId: comment._id },
            });
          }
        }
      }
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
      .sort({ createdAt: 1 });

    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

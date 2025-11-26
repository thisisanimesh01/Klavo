// backend/src/controllers/messageController.js
import Message from "../models/Message.js";

/**
 * GET /api/messages/:projectId
 * Get all messages for a project
 */
export const getMessagesForProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const messages = await Message.find({ projectId })
      .populate("user", "name email")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/messages/:projectId
 * Body: { text }
 * Create new message for a project
 */
export const createMessage = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const message = await Message.create({
      projectId,
      user: req.user._id,
      text: text.trim(),
    });

    // Populate user for client display
    const populated = await message.populate("user", "name email");

    // Emit via socket.io to everyone in this project room
    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("chatMessage", populated);
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error("Create message error:", err);
    res.status(500).json({ message: err.message });
  }
};

import Message from "../models/Message.js";
import { checkProjectAccess } from "../utils/authHelpers.js";

export const getMessagesForProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must be a member of the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view messages in this project" });
    }

    const messages = await Message.find({ projectId })
      .populate("user", "name email avatar")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const createMessage = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must be a member of the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to send messages in this project" });
    }

    const message = await Message.create({
      projectId,
      user: req.user._id,
      text: text.trim(),
    });

    const populated = await message.populate("user", "name email avatar");

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

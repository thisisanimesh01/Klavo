import Reaction from "../models/Reaction.js";

export const addReaction = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { emoji } = req.body;

    const reaction = await Reaction.create({
      commentId,
      userId: req.user._id,
      emoji,
    });

    const io = req.app.get("io");
    if (io) io.to(`comment_${commentId}`).emit("reactionAdded", reaction);

    res.status(201).json(reaction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

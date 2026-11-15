import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true },
  },
  { timestamps: true }
);

// Prevent duplicate identical emoji reactions by the same user on the same comment
reactionSchema.index({ commentId: 1, userId: 1, emoji: 1 }, { unique: true });

export const Reaction = mongoose.model("Reaction", reactionSchema);
export default Reaction;

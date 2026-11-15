import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

messageSchema.index({ projectId: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;

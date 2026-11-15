import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    url: { type: String, required: true },
    filename: String,
    size: Number,
    storageKey: String,
  },
  { timestamps: true }
);

fileSchema.index({ projectId: 1, createdAt: -1 });
fileSchema.index({ userId: 1 });

export const File = mongoose.model("File", fileSchema);
export default File;

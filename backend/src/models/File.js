import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    url: { type: String, required: true },
    filename: String,
    size: Number,
  },
  { timestamps: true }
);

export const File = mongoose.model("File", fileSchema);
export default File;

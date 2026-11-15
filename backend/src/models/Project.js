import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

projectSchema.index({ teamId: 1 });
projectSchema.index({ createdBy: 1 });

export const Project = mongoose.model("Project", projectSchema);

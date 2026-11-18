import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", maxlength: 500, trim: true },
    logo: { type: String, default: "" },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

teamSchema.index({ owner: 1 });
teamSchema.index({ members: 1 });

export const Team = mongoose.model("Team", teamSchema);
export default Team;

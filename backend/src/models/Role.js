import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    role: {
      type: String,
      enum: ["owner", "admin", "member", "viewer"],
      default: "member",
    },
  },
  { timestamps: true }
);

export const Role = mongoose.model("Role", roleSchema);
export default Role;

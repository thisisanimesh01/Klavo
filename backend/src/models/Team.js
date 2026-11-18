import mongoose from "mongoose";

const teamMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member", "guest"],
      default: "member",
      lowercase: true,
      trim: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

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
    // Array of ObjectIds for backward compatibility with existing queries
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Explicit role assignments per member (UX-06)
    memberRoles: [teamMemberSchema],
  },
  { timestamps: true }
);

teamSchema.index({ owner: 1 });
teamSchema.index({ members: 1 });
teamSchema.index({ "memberRoles.userId": 1 });

export const Team = mongoose.model("Team", teamSchema);
export default Team;

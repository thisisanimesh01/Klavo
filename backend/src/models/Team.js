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
      default: "member",
      lowercase: true,
      trim: true,
    },
    customRoleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomRole",
      default: null,
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
    // Enterprise organization parent association (null if standalone team)
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    // Array of ObjectIds for backward compatibility with existing queries
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Explicit role assignments per member (UX-06 + ENT-01)
    memberRoles: [teamMemberSchema],
    // Workspace-level security policies and governance
    policies: {
      allowedEmailDomains: {
        type: [String],
        default: [],
      },
      enforceDomainCheck: {
        type: Boolean,
        default: false,
      },
      allowMemberInvites: {
        type: Boolean,
        default: true,
      },
      allowPublicSharing: {
        type: Boolean,
        default: true,
      },
      sessionMaxAgeMinutes: {
        type: Number,
        default: 1440,
      },
    },
  },
  { timestamps: true }
);

teamSchema.index({ owner: 1 });
teamSchema.index({ members: 1 });
teamSchema.index({ "memberRoles.userId": 1 });
teamSchema.index({ organizationId: 1 });

export const Team = mongoose.model("Team", teamSchema);
export default Team;

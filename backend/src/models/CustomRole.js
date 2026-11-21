import mongoose from "mongoose";

const customRoleSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    description: {
      type: String,
      default: "",
      maxlength: 250,
    },
    // Granular configurable permission toggles
    permissions: {
      manageMembers: { type: Boolean, default: false },
      manageRoles: { type: Boolean, default: false },
      manageBilling: { type: Boolean, default: false },
      manageSettings: { type: Boolean, default: false },
      manageIntegrations: { type: Boolean, default: false },
      createProjects: { type: Boolean, default: true },
      deleteProjects: { type: Boolean, default: false },
      exportData: { type: Boolean, default: false },
      viewAuditLogs: { type: Boolean, default: false },
      manageAutomations: { type: Boolean, default: false },
    },
    isSystem: {
      type: Boolean,
      default: false, // true for built-in roles like "owner", "admin", "member", "guest"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

customRoleSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const CustomRole = mongoose.model("CustomRole", customRoleSchema);
export default CustomRole;

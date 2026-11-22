import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Associated workspaces (Teams) under this enterprise organization
    workspaces: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
      },
    ],
    // Enterprise Security Policies & Governance
    policies: {
      allowedEmailDomains: {
        type: [String],
        default: [], // e.g. ["@acme.corp", "@acme.com"] - empty means open to any domain
      },
      enforceDomainCheck: {
        type: Boolean,
        default: false,
      },
      requireMfa: {
        type: Boolean,
        default: false,
      },
      sessionMaxAgeMinutes: {
        type: Number,
        default: 1440, // 24 hours default
        min: 15,
        max: 43200, // 30 days max
      },
      dataRetentionDays: {
        type: Number,
        default: 365, // 1 year default audit & task log retention
        min: 30,
        max: 3650,
      },
      allowPublicSharing: {
        type: Boolean,
        default: true,
      },
      allowMemberInvites: {
        type: Boolean,
        default: true, // If false, only Admins/Owners can invite members
      },
    },
    // Enterprise Identity & SSO Configuration
    ssoConfig: {
      enabled: {
        type: Boolean,
        default: false,
      },
      provider: {
        type: String,
        enum: ["saml2", "oidc", "google_workspace", "none"],
        default: "none",
      },
      issuerUrl: {
        type: String,
        default: "",
      },
      clientId: {
        type: String,
        default: "",
      },
      encryptedClientSecret: {
        type: String,
        default: "",
      },
      entryPoint: {
        type: String, // Identity Provider SSO URL (SAML/OIDC)
        default: "",
      },
      certificate: {
        type: String, // IdP Public X.509 Certificate (PEM)
        default: "",
      },
      enforceSsoLogin: {
        type: Boolean,
        default: false, // If true, passwords bypassed, SSO strictly enforced for organization users
      },
    },
    // Directory Sync (SCIM 2.0 extension specification hook)
    scimConfig: {
      enabled: {
        type: Boolean,
        default: false,
      },
      scimEndpointUrl: {
        type: String,
        default: "",
      },
      bearerTokenHash: {
        type: String,
        default: "",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

organizationSchema.index({ ownerId: 1 });
organizationSchema.index({ workspaces: 1 });

export const Organization = mongoose.model("Organization", organizationSchema);
export default Organization;

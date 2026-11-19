import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // password is optional so Google users can exist without it
    password: {
      type: String,
      required: false,
    },

    avatar: {
      type: String,
      default: "",
    },

    bio: {
      type: String,
      default: "",
      maxlength: 500,
      trim: true,
    },

    roleTitle: {
      type: String,
      default: "",
      maxlength: 100,
      trim: true,
    },

    googleUser: {
      type: Boolean,
      default: false,
    },

    // Persistent Onboarding State (UX-08)
    onboarding: {
      completed: {
        type: Boolean,
        default: false,
      },
      dismissed: {
        type: Boolean,
        default: false,
      },
      step: {
        type: Number,
        default: 0,
      },
      completedSteps: {
        type: [String],
        default: [],
      },
      completedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
export default User;

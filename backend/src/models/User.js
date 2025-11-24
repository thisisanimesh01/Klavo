import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
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

    googleUser: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);

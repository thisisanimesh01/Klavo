import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { User } from "../models/User.js";
import { storageService, isSafeSvg } from "../services/storageService.js";
import { isBcryptHash } from "./authController.js";

const SALT_ROUNDS = 10;

/**
 * Get public profile of any user by ID (for directory / previews)
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("_id name email avatar bio roleTitle createdAt");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update authenticated user's profile details (name, bio, roleTitle)
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, bio, roleTitle } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      user.name = name.trim();
    }

    if (bio !== undefined) {
      user.bio = typeof bio === "string" ? bio.trim().slice(0, 500) : "";
    }

    if (roleTitle !== undefined) {
      user.roleTitle = typeof roleTitle === "string" ? roleTitle.trim().slice(0, 100) : "";
    }

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      roleTitle: user.roleTitle,
      googleUser: user.googleUser,
      onboarding: user.onboarding,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Upload and update user avatar using StorageService
 */
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No avatar image provided" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

    if (!allowedExtensions.includes(ext)) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Invalid image format for avatar" });
    }

    // Safety check for SVG
    if (ext === ".svg") {
      const buffer = fs.readFileSync(req.file.path);
      if (!isSafeSvg(buffer)) {
        if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Suspicious script content detected in SVG avatar" });
      }
    }

    const storageKey = `avatar-${user._id}-${Date.now()}${ext}`;
    await storageService.save(req.file, storageKey);

    // Delete prior avatar from disk if it was stored locally
    if (user.avatar && user.avatar.startsWith("/api/users/avatar/")) {
      const oldKey = user.avatar.replace("/api/users/avatar/", "");
      await storageService.delete(oldKey);
    }

    user.avatar = `/api/users/avatar/${storageKey}`;
    await user.save();

    res.json({
      message: "Avatar updated successfully",
      avatar: user.avatar,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        roleTitle: user.roleTitle,
      },
    });
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Serve user avatar stream with security headers
 */
export const serveAvatar = async (req, res) => {
  try {
    const { key } = req.params;
    let filePath;
    try {
      filePath = storageService.getFilePath(key);
    } catch {
      return res.status(400).json({ message: "Invalid avatar storage key" });
    }

    const exists = await storageService.exists(key);
    if (!exists) {
      return res.status(404).json({ message: "Avatar not found" });
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Change user password securely
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If user has an existing password, currentPassword is required and must match
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }

      let isMatch = false;
      if (isBcryptHash(user.password)) {
        isMatch = await bcrypt.compare(currentPassword, user.password);
      } else {
        isMatch = user.password === currentPassword;
      }

      if (!isMatch) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
    }

    // Hash and store new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get authenticated user's onboarding progress state (UX-08)
 */
export const getOnboardingState = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("onboarding createdAt");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const onboarding = user.onboarding || {
      completed: false,
      dismissed: false,
      step: 0,
      completedSteps: [],
      completedAt: null,
    };

    res.json(onboarding);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update authenticated user's onboarding state (UX-08)
 * Supports step progress, completing steps, dismiss/skip, and reset/restart
 */
export const updateOnboardingState = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { step, completed, dismissed, completedSteps, reset } = req.body;

    if (!user.onboarding) {
      user.onboarding = {
        completed: false,
        dismissed: false,
        step: 0,
        completedSteps: [],
        completedAt: null,
      };
    }

    if (reset) {
      user.onboarding = {
        completed: false,
        dismissed: false,
        step: 0,
        completedSteps: [],
        completedAt: null,
      };
      await user.save();
      return res.json({
        message: "Onboarding restarted successfully",
        onboarding: user.onboarding,
      });
    }

    if (typeof step === "number" && step >= 0) {
      user.onboarding.step = step;
    }

    if (typeof dismissed === "boolean") {
      user.onboarding.dismissed = dismissed;
    }

    if (Array.isArray(completedSteps)) {
      const merged = new Set([
        ...(user.onboarding.completedSteps || []),
        ...completedSteps.map((s) => String(s).trim()),
      ]);
      user.onboarding.completedSteps = Array.from(merged);
    }

    if (typeof completed === "boolean") {
      user.onboarding.completed = completed;
      if (completed && !user.onboarding.completedAt) {
        user.onboarding.completedAt = new Date();
      } else if (!completed) {
        user.onboarding.completedAt = null;
      }
    }

    await user.save();

    res.json({
      message: "Onboarding state updated",
      onboarding: user.onboarding,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

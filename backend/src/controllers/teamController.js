import fs from "fs";
import path from "path";
import { Team } from "../models/Team.js";
import { User } from "../models/User.js";
import { checkTeamAccess } from "../utils/authHelpers.js";
import { storageService, isSafeSvg } from "../services/storageService.js";

export const createTeam = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Team name required" });
    }

    const team = await Team.create({
      name: name.trim(),
      description: typeof description === "string" ? description.trim().slice(0, 500) : "",
      owner: req.user._id,
      members: [req.user._id],
    });

    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyTeams = async (req, res) => {
  try {
    const teams = await Team.find({
      $or: [{ members: req.user._id }, { owner: req.user._id }],
    })
      .populate("owner", "name email avatar bio roleTitle")
      .populate("members", "name email avatar bio roleTitle");

    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTeamById = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { isMember, team } = await checkTeamAccess(teamId, req.user._id);

    if (!team) return res.status(404).json({ message: "Team not found" });
    if (!isMember) {
      return res.status(403).json({ message: "Forbidden: You are not a member of this workspace" });
    }

    const populated = await Team.findById(teamId)
      .populate("owner", "name email avatar bio roleTitle")
      .populate("members", "name email avatar bio roleTitle");

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, description } = req.body;

    const { isOwner, isMember, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Only team owner can update workspace settings
    if (!isOwner) {
      return res.status(403).json({ message: "Forbidden: Only the workspace owner can modify workspace settings" });
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Workspace name cannot be empty" });
      }
      team.name = name.trim();
    }

    if (description !== undefined) {
      team.description = typeof description === "string" ? description.trim().slice(0, 500) : "";
    }

    await team.save();

    const populated = await Team.findById(teamId)
      .populate("owner", "name email avatar bio roleTitle")
      .populate("members", "name email avatar bio roleTitle");

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const uploadTeamLogo = async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: "No logo image provided" });
    }

    const { isOwner, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Team not found" });
    }

    if (!isOwner) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: "Forbidden: Only workspace owner can change workspace logo" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

    if (!allowedExtensions.includes(ext)) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Invalid image format for logo" });
    }

    if (ext === ".svg") {
      const buffer = fs.readFileSync(req.file.path);
      if (!isSafeSvg(buffer)) {
        if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Suspicious script content detected in SVG logo" });
      }
    }

    const storageKey = `team-logo-${team._id}-${Date.now()}${ext}`;
    await storageService.save(req.file, storageKey);

    if (team.logo && team.logo.startsWith("/api/teams/logo/")) {
      const oldKey = team.logo.replace("/api/teams/logo/", "");
      await storageService.delete(oldKey);
    }

    team.logo = `/api/teams/logo/${storageKey}`;
    await team.save();

    res.json({
      message: "Workspace logo updated successfully",
      logo: team.logo,
      team,
    });
  } catch (err) {
    console.error("Team logo upload error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const serveTeamLogo = async (req, res) => {
  try {
    const { key } = req.params;
    let filePath;
    try {
      filePath = storageService.getFilePath(key);
    } catch {
      return res.status(400).json({ message: "Invalid logo storage key" });
    }

    const exists = await storageService.exists(key);
    if (!exists) {
      return res.status(404).json({ message: "Logo not found" });
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const addMemberToTeam = async (req, res) => {
  try {
    const { teamId, email } = req.body;

    if (!teamId || !email) {
      return res.status(400).json({ message: "Team ID and member email are required" });
    }

    const { isMember, isOwner, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Only team owner or members can add new members
    if (!isMember) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to add members to this team" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isAlreadyMember = team.members.some((m) => m.toString() === user._id.toString());
    if (!isAlreadyMember) {
      team.members.push(user._id);
      await team.save();
    }

    const populated = await Team.findById(teamId)
      .populate("owner", "name email avatar bio roleTitle")
      .populate("members", "name email avatar bio roleTitle");

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const removeMemberFromTeam = async (req, res) => {
  try {
    const { teamId, memberId } = req.params;

    const { isOwner, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Only owner can remove other members, or a member can remove themselves (leave workspace)
    const isSelf = memberId.toString() === req.user._id.toString();
    if (!isOwner && !isSelf) {
      return res.status(403).json({ message: "Forbidden: You cannot remove another member from this workspace" });
    }

    // Workspace owner cannot be removed
    if (memberId.toString() === team.owner.toString()) {
      return res.status(400).json({ message: "Workspace owner cannot be removed" });
    }

    team.members = team.members.filter((m) => m.toString() !== memberId.toString());
    await team.save();

    const populated = await Team.findById(teamId)
      .populate("owner", "name email avatar bio roleTitle")
      .populate("members", "name email avatar bio roleTitle");

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteTeam = async (req, res) => {
  try {
    const { teamId } = req.params;

    const { isOwner, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Enforce owner-only team deletion
    if (!isOwner) {
      return res.status(403).json({ message: "Forbidden: Only the team owner can delete this team" });
    }

    await Team.findByIdAndDelete(teamId);
    res.json({ message: "Team deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

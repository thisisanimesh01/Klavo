import fs from "fs";
import path from "path";
import { Team } from "../models/Team.js";
import { User } from "../models/User.js";
import { checkTeamAccess, WORKSPACE_ROLES, resolveWorkspaceRole } from "../utils/authHelpers.js";
import { storageService, isSafeSvg } from "../services/storageService.js";

/**
 * Normalizes and populates team member list and memberRoles
 */
const getPopulatedTeam = async (teamId) => {
  return Team.findById(teamId)
    .populate("owner", "name email avatar bio roleTitle")
    .populate("members", "name email avatar bio roleTitle")
    .populate("memberRoles.userId", "name email avatar bio roleTitle");
};

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
      memberRoles: [{ userId: req.user._id, role: "owner" }],
    });

    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyTeams = async (req, res) => {
  try {
    const teams = await Team.find({
      $or: [
        { members: req.user._id },
        { owner: req.user._id },
        { "memberRoles.userId": req.user._id },
      ],
    })
      .populate("owner", "name email avatar bio roleTitle")
      .populate("members", "name email avatar bio roleTitle")
      .populate("memberRoles.userId", "name email avatar bio roleTitle");

    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTeamById = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { isMember, team, role, isAdmin, isOwner } = await checkTeamAccess(teamId, req.user._id);

    if (!team) return res.status(404).json({ message: "Team not found" });
    if (!isMember) {
      return res.status(403).json({ message: "Forbidden: You are not a member of this workspace" });
    }

    const populated = await getPopulatedTeam(teamId);
    res.json({
      ...populated.toObject(),
      currentUserRole: role,
      isAdmin,
      isOwner,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, description } = req.body;

    const { isAdmin, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Admins and owners can update workspace settings
    if (!isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Only workspace owners and admins can modify workspace settings",
      });
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

    const populated = await getPopulatedTeam(teamId);
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

    const { isAdmin, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Team not found" });
    }

    if (!isAdmin) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        message: "Forbidden: Only workspace owners and admins can change workspace logo",
      });
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
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    );
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const addMemberToTeam = async (req, res) => {
  try {
    const { teamId, email, role = "member" } = req.body;

    if (!teamId || !email) {
      return res.status(400).json({ message: "Team ID and member email are required" });
    }

    const targetRole = role.toLowerCase().trim();
    if (!WORKSPACE_ROLES.includes(targetRole) || targetRole === "owner") {
      return res.status(400).json({
        message: "Invalid role specified. Supported roles are admin, member, or guest.",
      });
    }

    const { isMember, isAdmin, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Only team owner or admins can add new members
    if (!isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Only workspace owners and admins can invite new members",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isAlreadyMember = team.members.some((m) => m.toString() === user._id.toString());
    if (!isAlreadyMember) {
      team.members.push(user._id);
    }

    // Set or update memberRoles
    if (!team.memberRoles) team.memberRoles = [];
    const existingRoleIdx = team.memberRoles.findIndex(
      (mr) => mr.userId.toString() === user._id.toString()
    );

    if (existingRoleIdx >= 0) {
      team.memberRoles[existingRoleIdx].role = targetRole;
    } else {
      team.memberRoles.push({ userId: user._id, role: targetRole });
    }

    await team.save();

    const populated = await getPopulatedTeam(teamId);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateMemberRole = async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ message: "Role is required" });
    }

    const targetRole = role.toLowerCase().trim();
    if (!["admin", "member", "guest"].includes(targetRole)) {
      return res.status(400).json({
        message: "Invalid role. Supported assignable roles are admin, member, or guest.",
      });
    }

    const { isOwner, isAdmin, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Only owner or admin can update member roles
    if (!isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Only workspace owners and admins can change member roles",
      });
    }

    // Privilege escalation prevention: Admins cannot promote anyone to Owner or modify Owner's role
    if (memberId.toString() === team.owner.toString()) {
      return res.status(400).json({
        message: "Cannot change the workspace owner's role directly. Use ownership transfer instead.",
      });
    }

    // Admins cannot demote other admins unless they are the Owner
    const currentTargetRole = resolveWorkspaceRole(team, memberId);
    if (currentTargetRole === "admin" && !isOwner) {
      return res.status(403).json({
        message: "Forbidden: Only the workspace owner can modify an admin's role",
      });
    }

    if (!team.memberRoles) team.memberRoles = [];
    const existingIdx = team.memberRoles.findIndex(
      (mr) => mr.userId.toString() === memberId.toString()
    );

    if (existingIdx >= 0) {
      team.memberRoles[existingIdx].role = targetRole;
    } else {
      team.memberRoles.push({ userId: memberId, role: targetRole });
    }

    await team.save();

    const populated = await getPopulatedTeam(teamId);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const transferOwnership = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return res.status(400).json({ message: "newOwnerId is required" });
    }

    const { isOwner, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Only current workspace owner can transfer ownership
    if (!isOwner) {
      return res.status(403).json({
        message: "Forbidden: Only the current workspace owner can transfer ownership",
      });
    }

    if (newOwnerId.toString() === team.owner.toString()) {
      return res.status(400).json({ message: "User is already the workspace owner" });
    }

    // New owner must already be a member of the workspace
    const isMember = team.members.some((m) => m.toString() === newOwnerId.toString());
    if (!isMember) {
      return res.status(400).json({
        message: "New owner must already be an active member of the workspace",
      });
    }

    const previousOwnerId = team.owner;
    team.owner = newOwnerId;

    // Update memberRoles: previous owner becomes admin, new owner becomes owner
    if (!team.memberRoles) team.memberRoles = [];

    const newOwnerIdx = team.memberRoles.findIndex(
      (mr) => mr.userId.toString() === newOwnerId.toString()
    );
    if (newOwnerIdx >= 0) {
      team.memberRoles[newOwnerIdx].role = "owner";
    } else {
      team.memberRoles.push({ userId: newOwnerId, role: "owner" });
    }

    const prevOwnerIdx = team.memberRoles.findIndex(
      (mr) => mr.userId.toString() === previousOwnerId.toString()
    );
    if (prevOwnerIdx >= 0) {
      team.memberRoles[prevOwnerIdx].role = "admin";
    } else {
      team.memberRoles.push({ userId: previousOwnerId, role: "admin" });
    }

    await team.save();

    const populated = await getPopulatedTeam(teamId);
    res.json({
      message: "Workspace ownership transferred successfully",
      team: populated,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const removeMemberFromTeam = async (req, res) => {
  try {
    const { teamId, memberId } = req.params;

    const { isOwner, isAdmin, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Workspace owner cannot be removed (last-owner protection)
    if (memberId.toString() === team.owner.toString()) {
      return res.status(400).json({
        message: "Workspace owner cannot be removed. Transfer ownership first before leaving.",
      });
    }

    const isSelf = memberId.toString() === req.user._id.toString();

    // Admins/owners can remove members, or a member can remove themselves (leave workspace)
    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to remove this member from the workspace",
      });
    }

    // Admins cannot remove other admins unless they are the Owner
    const targetRole = resolveWorkspaceRole(team, memberId);
    if (targetRole === "admin" && !isOwner && !isSelf) {
      return res.status(403).json({
        message: "Forbidden: Only the workspace owner can remove an administrator",
      });
    }

    team.members = team.members.filter((m) => m.toString() !== memberId.toString());
    if (team.memberRoles) {
      team.memberRoles = team.memberRoles.filter((mr) => mr.userId.toString() !== memberId.toString());
    }

    await team.save();

    const populated = await getPopulatedTeam(teamId);
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

    // Strict owner-only workspace deletion
    if (!isOwner) {
      return res.status(403).json({
        message: "Forbidden: Only the workspace owner can delete this workspace",
      });
    }

    await Team.findByIdAndDelete(teamId);
    res.json({ message: "Workspace deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

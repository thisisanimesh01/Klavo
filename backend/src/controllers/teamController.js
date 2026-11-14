import { Team } from "../models/Team.js";
import { User } from "../models/User.js";
import { checkTeamAccess } from "../utils/authHelpers.js";

export const createTeam = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Team name required" });
    }

    const team = await Team.create({
      name: name.trim(),
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
    }).populate("members", "name email");

    res.json(teams);
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

    const populated = await Team.findById(teamId).populate(
      "members",
      "name email"
    );

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

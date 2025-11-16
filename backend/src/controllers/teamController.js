import { Team } from "../models/Team.js";
import { User } from "../models/User.js";

// Create a new Team
export const createTeam = async (req, res) => {
  try {
    const { name, members } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Team name is required" });
    }

    // Check if team name already exists
    const existingTeam = await Team.findOne({ name });
    if (existingTeam) {
      return res.status(400).json({ message: "Team name already exists" });
    }

    // Validate members IDs (optional)
    const validMembers = [];
    if (members && members.length > 0) {
      for (const memberId of members) {
        const user = await User.findById(memberId);
        if (user) validMembers.push(user._id);
      }
    }

    const team = await Team.create({
      name,
      members: validMembers,
    });

    return res.status(201).json({ message: "Team created", team });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get team by ID with members populated
export const getTeamById = async (req, res) => {
  try {
    const { id } = req.params;

    const team = await Team.findById(id).populate("members", "-password -__v");
    if (!team) return res.status(404).json({ message: "Team not found" });

    res.json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a member to a team
export const addMemberToTeam = async (req, res) => {
  try {
    const { teamId, memberId } = req.body;

    if (!teamId || !memberId)
      return res.status(400).json({ message: "teamId and memberId are required" });

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (team.members.includes(memberId)) {
      return res.status(400).json({ message: "Member already in team" });
    }

    const user = await User.findById(memberId);
    if (!user) return res.status(404).json({ message: "User not found" });

    team.members.push(user._id);
    await team.save();

    res.json({ message: "Member added to team", team });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all teams for current user
export const getMyTeams = async (req, res) => {
  try {
    const userId = req.user._id;

    const teams = await Team.find({ members: userId }).populate("members", "-password -__v");

    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

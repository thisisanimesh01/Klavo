// backend/src/controllers/teamController.js
import { Team } from "../models/Team.js";
import { User } from "../models/User.js";

/* -----------------------------------------------------
   CREATE NEW TEAM
------------------------------------------------------*/
export const createTeam = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "Team name is required" });

    const team = await Team.create({
      name,
      members: [req.user._id], // creator is first member
    });

    const populatedTeam = await team.populate("members", "name email");

    res.status(201).json({
      message: "Team created successfully",
      team: populatedTeam,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* -----------------------------------------------------
   GET ALL TEAMS OF THE LOGGED-IN USER
------------------------------------------------------*/
export const getMyTeams = async (req, res) => {
  try {
    const teams = await Team.find({ members: req.user._id })
      .populate("members", "name email");

    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* -----------------------------------------------------
   ADD MEMBER TO TEAM
------------------------------------------------------*/
export const addMemberToTeam = async (req, res) => {
  try {
    const { teamId, memberId } = req.body;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (team.members.includes(memberId)) {
      return res.status(400).json({ message: "User already in team" });
    }

    team.members.push(memberId);
    await team.save();

    const updatedTeam = await Team.findById(teamId).populate("members", "name email");

    res.json({
      message: "Member added successfully",
      team: updatedTeam,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

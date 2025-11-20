// backend/src/controllers/teamController.js
import { Team } from "../models/Team.js";
import { User } from "../models/User.js";

export const createTeam = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "Team name required" });

    const team = await Team.create({
      name,
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
      members: req.user._id,
    }).populate("members", "name email");

    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const addMemberToTeam = async (req, res) => {
  try {
    const { teamId, email } = req.body;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!team.members.includes(user._id)) {
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
    await Team.findByIdAndDelete(teamId);
    res.json({ message: "Team deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

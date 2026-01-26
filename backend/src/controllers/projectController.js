import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";


export const createProject = async (req, res) => {
  try {
    const { name, description, teamId } = req.body;

    if (!name || !teamId) {
      return res.status(400).json({ message: "Name and teamId are required" });
    }

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    const project = await Project.create({
      name,
      description: description || "",
      teamId,
      createdBy: req.user._id,
    });

    // SOCKET.IO BROADCAST — NOTIFY ALL TEAM MEMBERS
    const io = req.app.get("io");
    if (io) {
      io.to(`team_${teamId}`).emit("projectCreated", {
        ...project.toObject(),
      });
    }

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

  // Get all projects for teams the user is a member of
export const getProjects = async (req, res) => {
  try {
    // ✔ Find all teams where user is a member
    const teams = await Team.find({
      members: req.user._id,
    }).select("_id");

    const teamIds = teams.map((t) => t._id);

    // Find all projects for those teams
    const projects = await Project.find({
      teamId: { $in: teamIds },
    })
      .populate("teamId", "name")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


export const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);

    if (!project)
      return res.status(404).json({ message: "Project not found" });

    await Project.findByIdAndDelete(projectId);

    // SOCKET.IO BROADCAST — NOTIFY ALL TEAM MEMBERS
    const io = req.app.get("io");
    if (io) {
      io.to(`team_${project.teamId}`).emit("projectDeleted", {
        projectId,
      });
    }

    res.json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


export const getProjectMembers = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate("teamId");
    if (!project) return res.status(404).json({ message: "Project not found" });

    const team = await Team.findById(project.teamId._id)
      .populate("members", "name email");

    res.json(team.members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

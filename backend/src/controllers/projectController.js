import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";
import { checkTeamAccess, checkProjectAccess } from "../utils/authHelpers.js";

export const createProject = async (req, res) => {
  try {
    const { name, description, teamId } = req.body;

    if (!name || !teamId) {
      return res.status(400).json({ message: "Name and teamId are required" });
    }

    const { isMember, team } = await checkTeamAccess(teamId, req.user._id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Enforce membership verification before creating project
    if (!isMember) {
      return res.status(403).json({ message: "Forbidden: You are not a member of this team" });
    }

    const project = await Project.create({
      name: name.trim(),
      description: description ? description.trim() : "",
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

// Get all projects for teams the user is a member/owner of
export const getProjects = async (req, res) => {
  try {
    // Find all teams where user is a member or owner
    const teams = await Team.find({
      $or: [{ members: req.user._id }, { owner: req.user._id }],
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

    const { hasAccess, isOwner, project, team } = await checkProjectAccess(projectId, req.user._id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Only project creator or team owner can delete a project
    const isProjectCreator = project.createdBy.toString() === req.user._id.toString();
    if (!hasAccess || (!isProjectCreator && !isOwner)) {
      return res.status(403).json({ message: "Forbidden: Only project creator or team owner can delete this project" });
    }

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

    const { hasAccess, project, team } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not a member of the project team" });
    }

    const populatedTeam = await Team.findById(team._id).populate("members", "name email");

    res.json(populatedTeam.members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project, team } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not a member of the project team" });
    }

    const populatedProject = await Project.findById(projectId)
      .populate("teamId", "name owner members")
      .populate("createdBy", "name email");

    res.json(populatedProject);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

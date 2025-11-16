import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";

// Create a new project
export const createProject = async (req, res) => {
  try {
    const { title, description, teamId } = req.body;
    const userId = req.user._id;

    if (!title || !teamId) {
      return res.status(400).json({ message: "Title and Team ID are required" });
    }

    // Check if team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Check if user is member of team
    if (!team.members.includes(userId)) {
      return res.status(403).json({ message: "You are not a member of this team" });
    }

    const project = await Project.create({
      title,
      description,
      teamId,
      createdBy: userId,
    });

    // Add project ID to team's projects array
    team.projects.push(project._id);
    await team.save();

    res.status(201).json({ message: "Project created", project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get project by ID
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id)
      .populate("teamId", "name")
      .populate("createdBy", "name email");

    if (!project) return res.status(404).json({ message: "Project not found" });

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update project (title, description, status)
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;
    const userId = req.user._id;

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // Check if user is creator of project
    if (!project.createdBy.equals(userId)) {
      return res.status(403).json({ message: "You are not allowed to update this project" });
    }

    if (title) project.title = title;
    if (description) project.description = description;
    if (status && ["active", "archived"].includes(status)) project.status = status;

    await project.save();

    res.json({ message: "Project updated", project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all projects for a team
export const getProjectsByTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user._id;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (!team.members.includes(userId)) {
      return res.status(403).json({ message: "You are not a member of this team" });
    }

    const projects = await Project.find({ teamId }).sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

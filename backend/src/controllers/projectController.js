// backend/src/controllers/projectController.js
import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";

/* Create project */
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

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Get all projects for user */
export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      createdBy: req.user._id,
    }).populate("teamId", "name");

    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Delete project */
export const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    await Project.findByIdAndDelete(projectId);
    res.json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ✅ Get members of the team that owns this project */
export const getProjectMembers = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate("teamId");
    if (!project) return res.status(404).json({ message: "Project not found" });

    const team = await Team.findById(project.teamId._id).populate(
      "members",
      "name email"
    );

    res.json(team.members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

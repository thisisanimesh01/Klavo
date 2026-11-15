import TaskTemplate from "../models/TaskTemplate.js";
import { Project } from "../models/Project.js";
import { checkTeamAccess, checkProjectAccess } from "../utils/authHelpers.js";
import { logActivity } from "./activityController.js";

/**
 * Creates a reusable task template.
 */
export const createTaskTemplate = async (req, res) => {
  try {
    const {
      name,
      description,
      teamId,
      projectId,
      defaultTitle,
      defaultDescription,
      defaultPriority,
      defaultLabels,
      defaultCustomFields,
      checklist,
      estimatedHours,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Template name is required" });
    }

    let resolvedTeamId = teamId;

    if (projectId) {
      const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!hasAccess) {
        return res.status(403).json({ message: "Forbidden: You are not authorized to create templates in this project" });
      }
      resolvedTeamId = project.teamId;
    } else if (teamId) {
      const { isMember } = await checkTeamAccess(teamId, req.user._id);
      if (!isMember) {
        return res.status(403).json({ message: "Forbidden: You are not authorized to create templates in this team" });
      }
    } else {
      return res.status(400).json({ message: "Either teamId or projectId is required" });
    }

    const template = await TaskTemplate.create({
      name: name.trim(),
      description: description || "",
      teamId: resolvedTeamId,
      projectId: projectId || null,
      defaultTitle: defaultTitle || "",
      defaultDescription: defaultDescription || "",
      defaultPriority: defaultPriority || "medium",
      defaultLabels: Array.isArray(defaultLabels) ? defaultLabels : [],
      defaultCustomFields: Array.isArray(defaultCustomFields) ? defaultCustomFields : [],
      checklist: Array.isArray(checklist) ? checklist : [],
      estimatedHours: estimatedHours !== undefined ? estimatedHours : null,
      createdBy: req.user._id,
    });

    if (projectId) {
      await logActivity({
        projectId,
        userId: req.user._id,
        action: "Created Task Template",
        message: `${req.user.name} created task template "${template.name}"`,
      });
    }

    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Lists templates accessible for a project or team.
 */
export const getTaskTemplates = async (req, res) => {
  try {
    const { projectId, teamId } = req.query;

    if (!projectId && !teamId) {
      return res.status(400).json({ message: "Query parameter projectId or teamId is required" });
    }

    let filter = {};

    if (projectId) {
      const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!hasAccess) {
        return res.status(403).json({ message: "Forbidden: You are not authorized to view templates for this project" });
      }

      // Return templates specifically for this project OR team-wide templates
      filter = {
        $or: [
          { projectId },
          { teamId: project.teamId, projectId: null },
        ],
      };
    } else if (teamId) {
      const { isMember } = await checkTeamAccess(teamId, req.user._id);
      if (!isMember) {
        return res.status(403).json({ message: "Forbidden: You are not authorized to view templates for this team" });
      }

      filter = { teamId };
    }

    const templates = await TaskTemplate.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Gets a specific template by ID.
 */
export const getTaskTemplateById = async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = await TaskTemplate.findById(templateId);
    if (!template) return res.status(404).json({ message: "Task template not found" });

    const { isMember } = await checkTeamAccess(template.teamId, req.user._id);
    if (!isMember) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this template" });
    }

    res.json(template);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates a template.
 */
export const updateTaskTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = await TaskTemplate.findById(templateId);
    if (!template) return res.status(404).json({ message: "Task template not found" });

    const { isMember } = await checkTeamAccess(template.teamId, req.user._id);
    if (!isMember) {
      return res.status(403).json({ message: "Forbidden: You do not have access to update this template" });
    }

    const allowed = [
      "name",
      "description",
      "defaultTitle",
      "defaultDescription",
      "defaultPriority",
      "defaultLabels",
      "defaultCustomFields",
      "checklist",
      "estimatedHours",
    ];

    allowed.forEach((f) => {
      if (req.body[f] !== undefined) template[f] = req.body[f];
    });

    await template.save();
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Deletes a template.
 */
export const deleteTaskTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = await TaskTemplate.findById(templateId);
    if (!template) return res.status(404).json({ message: "Task template not found" });

    const { isMember } = await checkTeamAccess(template.teamId, req.user._id);
    if (!isMember) {
      return res.status(403).json({ message: "Forbidden: You do not have access to delete this template" });
    }

    await TaskTemplate.findByIdAndDelete(templateId);
    res.json({ message: "Task template deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

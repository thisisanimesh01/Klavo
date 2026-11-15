import Workflow from "../models/Workflow.js";
import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { logActivity } from "./activityController.js";
import { checkProjectAccess } from "../utils/authHelpers.js";
import { DEFAULT_STATUSES, getOrCreateProjectWorkflow } from "../utils/workflowHelpers.js";

/**
 * Get the workflow for a specific project.
 * If none exists, creates and returns the default workflow.
 */
export const getProjectWorkflow = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view this project workflow" });
    }

    let workflow = await getOrCreateProjectWorkflow(projectId, project.teamId, req.user._id);
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update project workflow (rename statuses, reorder, change colors/categories, or update name/description).
 */
export const updateProjectWorkflow = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, statuses } = req.body;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to update this project workflow" });
    }

    let workflow = await getOrCreateProjectWorkflow(projectId, project.teamId, req.user._id);

    if (name !== undefined) workflow.name = name.trim();
    if (description !== undefined) workflow.description = description.trim();

    if (Array.isArray(statuses)) {
      if (statuses.length < 2) {
        return res.status(400).json({ message: "A workflow must have at least 2 statuses" });
      }

      // Validate required categories: must have at least 1 todo and at least 1 done
      const hasTodo = statuses.some((s) => s.category === "todo");
      const hasDone = statuses.some((s) => s.category === "done");
      if (!hasTodo || !hasDone) {
        return res.status(400).json({
          message: "Workflow must contain at least one status in todo category and one in done category",
        });
      }

      // Validate unique keys and format
      const seenKeys = new Set();
      const sanitizedStatuses = [];

      for (let i = 0; i < statuses.length; i++) {
        const s = statuses[i];
        if (!s.name || !s.name.trim()) {
          return res.status(400).json({ message: `Status at position ${i + 1} must have a valid name` });
        }

        const rawKey = s.key ? s.key.trim().toLowerCase() : s.name.trim().toLowerCase().replace(/\s+/g, "-");
        const key = rawKey.replace(/[^a-z0-9_-]/g, "");

        if (!key) {
          return res.status(400).json({ message: `Invalid status key generated for "${s.name}"` });
        }

        if (seenKeys.has(key)) {
          return res.status(400).json({ message: `Duplicate status key: "${key}". Status keys must be unique` });
        }
        seenKeys.add(key);

        const validCategories = ["todo", "in_progress", "review", "done"];
        const category = validCategories.includes(s.category) ? s.category : "in_progress";

        sanitizedStatuses.push({
          key,
          name: s.name.trim(),
          color: s.color || "#6366f1",
          category,
          order: s.order !== undefined ? Number(s.order) : i,
        });
      }

      // Check if any deleted status currently has tasks assigned to it
      const currentKeys = new Set(sanitizedStatuses.map((s) => s.key));
      const oldKeys = workflow.statuses.map((s) => s.key);
      const removedKeys = oldKeys.filter((k) => !currentKeys.has(k));

      if (removedKeys.length > 0) {
        const activeTaskCount = await Task.countDocuments({
          projectId,
          status: { $in: removedKeys },
        });

        if (activeTaskCount > 0) {
          return res.status(400).json({
            message: `Cannot remove statuses [${removedKeys.join(", ")}]: ${activeTaskCount} task(s) are currently in these statuses. Migrate them before removing.`,
            removedKeys,
            activeTaskCount,
          });
        }
      }

      workflow.statuses = sanitizedStatuses;
      workflow.isDefault = false;
    }

    await workflow.save();

    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Updated Workflow",
      message: `${req.user.name} updated the project workflow configuration`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("workflowUpdated", workflow);
    }

    res.json(workflow);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Reset project workflow back to the standard default 4-stage workflow.
 */
export const resetProjectWorkflow = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to reset this project workflow" });
    }

    let workflow = await getOrCreateProjectWorkflow(projectId, project.teamId, req.user._id);

    // If there are custom tasks, migrate them to default keys if necessary or check constraints
    workflow.name = "Default Workflow";
    workflow.description = "Standard project lifecycle workflow";
    workflow.statuses = DEFAULT_STATUSES;
    workflow.isDefault = true;

    await workflow.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("workflowUpdated", workflow);
    }

    res.json(workflow);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

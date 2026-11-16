import SavedView from "../models/SavedView.js";
import { checkProjectAccess } from "../utils/authHelpers.js";

/**
 * Creates a new saved view for a project.
 * View can be personal (isShared: false) or project-wide (isShared: true).
 */
export const createSavedView = async (req, res) => {
  try {
    const {
      name,
      description,
      projectId,
      isShared,
      viewType,
      filters,
      sortBy,
      sortOrder,
      groupBy,
      columns,
      isDefault,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Saved view name is required" });
    }

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must belong to the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to create saved views in this project" });
    }

    // If isDefault is true and isShared is true, only team owner or project creator can set shared default
    // Otherwise user can set default for their own view scope
    if (isDefault) {
      if (isShared) {
        // Reset existing shared defaults
        await SavedView.updateMany({ projectId, isShared: true }, { $set: { isDefault: false } });
      } else {
        // Reset user's personal defaults
        await SavedView.updateMany(
          { projectId, createdBy: req.user._id, isShared: false },
          { $set: { isDefault: false } }
        );
      }
    }

    const savedView = await SavedView.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      projectId,
      teamId: project.teamId,
      createdBy: req.user._id,
      isShared: Boolean(isShared),
      viewType: viewType || "all",
      filters: filters || {},
      sortBy: sortBy || "order",
      sortOrder: sortOrder || "asc",
      groupBy: groupBy || "none",
      columns: Array.isArray(columns) ? columns : [],
      isDefault: Boolean(isDefault),
    });

    await savedView.populate("createdBy", "name email avatar");

    const io = req.app.get("io");
    if (io && isShared) {
      io.to(`project_${projectId}`).emit("savedViewCreated", savedView);
    }

    res.status(201).json(savedView);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves all saved views accessible to the user in a project:
 * - Shared views created by anyone in the project
 * - Personal views created by req.user._id
 */
export const getSavedViewsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { viewType } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view saved views in this project" });
    }

    const query = {
      projectId,
      $or: [{ isShared: true }, { createdBy: req.user._id }],
    };

    if (viewType && viewType !== "all") {
      query.viewType = { $in: [viewType, "all"] };
    }

    const views = await SavedView.find(query)
      .populate("createdBy", "name email avatar")
      .sort({ isDefault: -1, isShared: -1, name: 1 });

    res.json(views);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Gets a single saved view by ID with authorization verification.
 */
export const getSavedViewById = async (req, res) => {
  try {
    const { viewId } = req.params;

    const savedView = await SavedView.findById(viewId).populate("createdBy", "name email avatar");
    if (!savedView) return res.status(404).json({ message: "Saved view not found" });

    const { hasAccess } = await checkProjectAccess(savedView.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to access this project" });
    }

    // If private view, only creator can view it
    if (!savedView.isShared && savedView.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden: This is a private saved view" });
    }

    res.json(savedView);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates a saved view.
 * Authorization rules:
 * - Private view: Only creator can update.
 * - Shared view: Creator or Team Owner can update.
 */
export const updateSavedView = async (req, res) => {
  try {
    const { viewId } = req.params;
    const {
      name,
      description,
      isShared,
      viewType,
      filters,
      sortBy,
      sortOrder,
      groupBy,
      columns,
      isDefault,
    } = req.body;

    const savedView = await SavedView.findById(viewId);
    if (!savedView) return res.status(404).json({ message: "Saved view not found" });

    const { hasAccess, isOwner } = await checkProjectAccess(savedView.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to access this project" });
    }

    // Ownership check: creator or team owner
    const isCreator = savedView.createdBy.toString() === req.user._id.toString();
    if (!isCreator && !isOwner) {
      return res.status(403).json({ message: "Forbidden: Only the view creator or team owner can update this view" });
    }

    if (name && name.trim()) savedView.name = name.trim();
    if (description !== undefined) savedView.description = description.trim();
    if (viewType) savedView.viewType = viewType;
    if (filters !== undefined) savedView.filters = filters;
    if (sortBy) savedView.sortBy = sortBy;
    if (sortOrder) savedView.sortOrder = sortOrder;
    if (groupBy) savedView.groupBy = groupBy;
    if (columns !== undefined) savedView.columns = columns;

    if (isShared !== undefined) {
      savedView.isShared = Boolean(isShared);
    }

    if (isDefault !== undefined && isDefault) {
      if (savedView.isShared) {
        await SavedView.updateMany(
          { projectId: savedView.projectId, isShared: true, _id: { $ne: savedView._id } },
          { $set: { isDefault: false } }
        );
      } else {
        await SavedView.updateMany(
          {
            projectId: savedView.projectId,
            createdBy: req.user._id,
            isShared: false,
            _id: { $ne: savedView._id },
          },
          { $set: { isDefault: false } }
        );
      }
      savedView.isDefault = true;
    } else if (isDefault !== undefined) {
      savedView.isDefault = Boolean(isDefault);
    }

    await savedView.save();
    await savedView.populate("createdBy", "name email avatar");

    const io = req.app.get("io");
    if (io && savedView.isShared) {
      io.to(`project_${savedView.projectId}`).emit("savedViewUpdated", savedView);
    }

    res.json(savedView);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Deletes a saved view.
 * Authorization rules:
 * - Only creator or Team Owner can delete.
 */
export const deleteSavedView = async (req, res) => {
  try {
    const { viewId } = req.params;

    const savedView = await SavedView.findById(viewId);
    if (!savedView) return res.status(404).json({ message: "Saved view not found" });

    const { hasAccess, isOwner } = await checkProjectAccess(savedView.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to access this project" });
    }

    const isCreator = savedView.createdBy.toString() === req.user._id.toString();
    if (!isCreator && !isOwner) {
      return res.status(403).json({ message: "Forbidden: Only the view creator or team owner can delete this view" });
    }

    const wasShared = savedView.isShared;
    const projectId = savedView.projectId;

    await savedView.deleteOne();

    const io = req.app.get("io");
    if (io && wasShared) {
      io.to(`project_${projectId}`).emit("savedViewDeleted", { viewId });
    }

    res.json({ message: "Saved view deleted successfully", viewId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

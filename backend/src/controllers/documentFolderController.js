import DocumentFolder from "../models/DocumentFolder.js";
import Document from "../models/Document.js";
import { checkProjectAccess } from "../utils/authHelpers.js";
import { logActivity } from "./activityController.js";
import {
  checkCircularFolderNesting,
  getFolderBreadcrumbs,
  getDescendantFolderIds,
} from "../utils/folderHelpers.js";

/**
 * Creates a new document folder within a project.
 */
export const createFolder = async (req, res) => {
  try {
    const { name, description, color, icon, parentId, projectId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Folder name is required" });
    }

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection
    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to create folders in this project",
      });
    }

    // Verify parent folder if provided
    let safeParentId = null;
    if (parentId && parentId !== "null" && parentId !== "root") {
      const parentFolder = await DocumentFolder.findOne({ _id: parentId, projectId });
      if (!parentFolder) {
        return res.status(400).json({
          message: "Parent folder not found or belongs to a different project",
        });
      }
      safeParentId = parentFolder._id;
    }

    const count = await DocumentFolder.countDocuments({ projectId, parentId: safeParentId });

    const folder = await DocumentFolder.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      color: color || "#6366f1",
      icon: icon || "folder",
      parentId: safeParentId,
      projectId,
      teamId: project.teamId,
      createdBy: req.user._id,
      order: count,
    });

    await folder.populate("createdBy", "name email avatar");

    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Created Folder",
      message: `${req.user.name} created folder "${folder.name}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("documentFolderCreated", folder);
    }

    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves all folders for a project with document count aggregates.
 */
export const getFoldersByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { parentId } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view folders in this project",
      });
    }

    const filter = { projectId, isArchived: false };
    if (parentId !== undefined) {
      if (parentId === "null" || parentId === "" || parentId === "root") {
        filter.parentId = null;
      } else {
        filter.parentId = parentId;
      }
    }

    const folders = await DocumentFolder.find(filter)
      .populate("createdBy", "name email avatar")
      .sort({ order: 1, name: 1 });

    // Aggregate active document counts per folder
    const folderIds = folders.map((f) => f._id);
    const docCounts = await Document.aggregate([
      { $match: { folderId: { $in: folderIds }, isArchived: false } },
      { $group: { _id: "$folderId", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(docCounts.map((d) => [d._id.toString(), d.count]));

    const foldersWithCounts = folders.map((f) => ({
      ...f.toObject(),
      documentCount: countMap.get(f._id.toString()) || 0,
    }));

    res.json(foldersWithCounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Retrieves a single folder by ID with breadcrumb ancestry.
 */
export const getFolderById = async (req, res) => {
  try {
    const { folderId } = req.params;

    const folder = await DocumentFolder.findById(folderId).populate(
      "createdBy",
      "name email avatar"
    );
    if (!folder) return res.status(404).json({ message: "Folder not found" });

    const { hasAccess } = await checkProjectAccess(folder.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view this folder",
      });
    }

    const breadcrumbs = await getFolderBreadcrumbs(folder._id);
    const documentCount = await Document.countDocuments({
      folderId: folder._id,
      isArchived: false,
    });

    res.json({
      ...folder.toObject(),
      breadcrumbs,
      documentCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Updates a folder (rename, metadata, or move to new parent folder).
 * Enforces anti-circular reference checks.
 */
export const updateFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { name, description, color, icon, parentId, isArchived, order } = req.body;

    const folder = await DocumentFolder.findById(folderId);
    if (!folder) return res.status(404).json({ message: "Folder not found" });

    const { hasAccess } = await checkProjectAccess(folder.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to update this folder",
      });
    }

    // Circular nesting detection if parentId is being modified
    if (parentId !== undefined) {
      let targetParentId = null;
      if (parentId && parentId !== "null" && parentId !== "root") {
        const targetParent = await DocumentFolder.findOne({
          _id: parentId,
          projectId: folder.projectId,
        });
        if (!targetParent) {
          return res.status(400).json({
            message: "Target parent folder not found or belongs to a different project",
          });
        }
        targetParentId = targetParent._id;
      }

      if (targetParentId) {
        const { isCircular } = await checkCircularFolderNesting(folder._id, targetParentId);
        if (isCircular) {
          return res.status(400).json({
            message: "Cannot move folder: circular nesting detected",
          });
        }
      }

      folder.parentId = targetParentId;
    }

    if (name && name.trim()) folder.name = name.trim();
    if (description !== undefined) folder.description = description.trim();
    if (color) folder.color = color;
    if (icon) folder.icon = icon;
    if (isArchived !== undefined) folder.isArchived = Boolean(isArchived);
    if (order !== undefined) folder.order = Number(order) || 0;

    await folder.save();
    await folder.populate("createdBy", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${folder.projectId}`).emit("documentFolderUpdated", folder);
    }

    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Deletes a folder with safe handling of descendant folders and documents.
 * Reparents child folders and contained documents to null (Root/Unfiled) to prevent orphaning.
 */
export const deleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;

    const folder = await DocumentFolder.findById(folderId);
    if (!folder) return res.status(404).json({ message: "Folder not found" });

    const { hasAccess, isOwner } = await checkProjectAccess(folder.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to delete this folder",
      });
    }

    const isCreator = folder.createdBy.toString() === req.user._id.toString();
    if (!isCreator && !isOwner) {
      return res.status(403).json({
        message: "Forbidden: Only the folder creator or team owner can delete this folder",
      });
    }

    const projectId = folder.projectId;

    // Reparent immediate child folders to the deleted folder's parentId (or root)
    await DocumentFolder.updateMany(
      { parentId: folderId },
      { $set: { parentId: folder.parentId || null } }
    );

    // Reparent all contained documents to the deleted folder's parentId (or root)
    await Document.updateMany(
      { folderId: folderId },
      { $set: { folderId: folder.parentId || null } }
    );

    await folder.deleteOne();

    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Deleted Folder",
      message: `${req.user.name} deleted folder "${folder.name}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("documentFolderDeleted", { folderId });
    }

    res.json({ message: "Folder deleted successfully", folderId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

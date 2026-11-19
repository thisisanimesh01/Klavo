import path from "path";
import File from "../models/File.js";
import { checkProjectAccess } from "../utils/authHelpers.js";
import { logActivity } from "./activityController.js";
import { storageService } from "../services/storageService.js";

// Upload File
export const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const { projectId } = req.body;
    if (!projectId) {
      await storageService.delete(file.filename);
      return res.status(400).json({ message: "Project ID is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) {
      await storageService.delete(file.filename);
      return res.status(404).json({ message: "Project not found" });
    }

    // IDOR protection: User must be a member of the project team
    if (!hasAccess) {
      await storageService.delete(file.filename);
      return res.status(403).json({ message: "Forbidden: You are not authorized to upload files to this project" });
    }

    // Persist via StorageService abstraction
    const storageResult = await storageService.save(file, file.filename);

    // Sanitize original filename (remove dangerous characters/path separators)
    const sanitizedOriginalName = path.basename(file.originalname).replace(/[\r\n\0]/g, "");

    const saved = await File.create({
      projectId,
      userId: req.user._id,
      url: `/api/files/download/`,
      filename: sanitizedOriginalName,
      size: file.size,
      storageKey: storageResult.storageKey,
    });

    // Populate user
    const populated = await File.findById(saved._id).populate("userId", "name email avatar");

    // Log activity and emit
    await logActivity({
      projectId,
      userId: req.user._id,
      action: "Uploaded File",
      message: `${req.user.name} uploaded "${sanitizedOriginalName}"`,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`project_${projectId}`).emit("activityCreated", {
        projectId,
        user: { name: req.user.name },
        action: "Uploaded File",
        message: `${req.user.name} uploaded "${sanitizedOriginalName}"`,
        createdAt: new Date(),
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    if (req.file) {
      await storageService.delete(req.file.filename);
    }
    res.status(500).json({ message: err.message });
  }
};

// Get files for a project
export const getProjectFiles = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must be a member of the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view files for this project" });
    }

    const files = await File.find({ projectId })
      .populate("userId", "name email avatar")
      .sort({ createdAt: -1 });

    res.json(files);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Download / stream file with authorization and security headers
export const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ message: "File not found" });

    const { hasAccess } = await checkProjectAccess(fileRecord.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to access this file" });
    }

    const storageFilename = fileRecord.storageKey || fileRecord.filename;
    const exists = await storageService.exists(storageFilename);
    if (!exists) {
      return res.status(404).json({ message: "File binary not found on server" });
    }

    // Security Headers:
    // 1. Content-Disposition attachment forces download rather than inline execution
    // 2. nosniff prevents browser MIME type sniffing
    // 3. CSP restricts any active SVG or HTML script execution
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    );

    // If local provider and file path is available, stream via res.download
    if (storageService.type === "local") {
      let filePath;
      try {
        filePath = storageService.getFilePath(storageFilename);
      } catch (e) {
        return res.status(400).json({ message: "Invalid file storage key" });
      }
      return res.download(filePath, fileRecord.filename);
    }

    // Cloud S3 / Object storage provider: stream binary buffer with attachment header
    const objectData = await storageService.getObject(storageFilename);
    if (!objectData) {
      return res.status(404).json({ message: "File binary not found on server" });
    }

    const safeFilename = path.basename(fileRecord.filename).replace(/["\r\n]/g, "");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.setHeader("Content-Type", objectData.contentType || "application/octet-stream");
    res.setHeader("Content-Length", objectData.contentLength);
    res.send(objectData.buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete file with authorization (File uploader or Project creator or Team owner)
export const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ message: "File not found" });

    const { hasAccess, isOwner, project } = await checkProjectAccess(fileRecord.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to manage files in this project" });
    }

    const isUploader = fileRecord.userId.toString() === req.user._id.toString();
    const isProjectCreator = project?.createdBy?.toString() === req.user._id.toString();

    if (!isUploader && !isProjectCreator && !isOwner) {
      return res.status(403).json({ message: "Forbidden: Only the file uploader or project/team admin can delete this file" });
    }

    // Remove file binary via storage service
    const storageFilename = fileRecord.storageKey || fileRecord.filename;
    await storageService.delete(storageFilename);

    await File.findByIdAndDelete(fileId);

    res.json({ message: "File deleted successfully", fileId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

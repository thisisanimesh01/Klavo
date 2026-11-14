import fs from "fs";
import path from "path";
import File from "../models/File.js";
import { checkProjectAccess } from "../utils/authHelpers.js";

// Upload File
export const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ message: "Project ID is required" });

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // IDOR protection: User must be a member of the project team
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to upload files to this project" });
    }

    const saved = await File.create({
      projectId,
      userId: req.user._id,
      url: `/api/files/download/`, // will be referenced with file._id
      filename: file.originalname,
      size: file.size,
      storageKey: file.filename, // local storage filename in backend/uploads/
    });

    // Populate user
    const populated = await File.findById(saved._id).populate("userId", "name email avatar");

    res.status(201).json(populated);
  } catch (err) {
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

// Download / stream file with authorization
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
    const filePath = path.resolve("uploads", storageFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File binary not found on server" });
    }

    res.download(filePath, fileRecord.filename);
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

    // Remove local file if exists
    const storageFilename = fileRecord.storageKey || fileRecord.filename;
    const filePath = path.resolve("uploads", storageFilename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn("Could not delete local file binary:", e.message);
      }
    }

    await File.findByIdAndDelete(fileId);

    res.json({ message: "File deleted successfully", fileId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

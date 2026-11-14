import { uploadToCloudinary } from "../utils/cloudinary.js";
import File from "../models/File.js";
import { checkProjectAccess } from "../utils/authHelpers.js";

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

    const upload = await uploadToCloudinary(file.path);

    const saved = await File.create({
      projectId,
      userId: req.user._id,
      url: upload.secure_url,
      filename: file.originalname,
      size: file.size,
    });

    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

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
      .sort({ createdAt: -1 });

    res.json(files);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

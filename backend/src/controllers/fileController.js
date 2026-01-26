import { uploadToCloudinary } from "../utils/cloudinary.js";
import File from "../models/File.js";

export const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const upload = await uploadToCloudinary(file.path);

    const saved = await File.create({
      projectId: req.body.projectId,
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
    const files = await File.find({ projectId: req.params.projectId })
      .sort({ createdAt: -1 });

    res.json(files);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

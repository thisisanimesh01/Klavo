// backend/src/routes/fileRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import { authRequired } from "../middleware/authMiddleware.js";
import { checkProjectAccess } from "../utils/authHelpers.js";

const router = express.Router();

// Save uploads inside backend/uploads/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});

const upload = multer({ storage });

// File upload API with authorization
router.post("/upload", authRequired, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { projectId } = req.body;
    if (projectId) {
      const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!hasAccess) {
        return res.status(403).json({ message: "Forbidden: You are not authorized to upload files to this project" });
      }
    }

    res.json({
      message: "File uploaded successfully",
      file: req.file.filename,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

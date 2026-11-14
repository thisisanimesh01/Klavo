import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  uploadFile,
  getProjectFiles,
  downloadFile,
  deleteFile,
} from "../controllers/fileController.js";

const router = express.Router();

// Ensure uploads/ directory exists
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Save uploads inside backend/uploads/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max limit
});

router.use(authRequired);

// File CRUD APIs
router.post("/upload", upload.single("file"), uploadFile);
router.get("/project/:projectId", getProjectFiles);
router.get("/download/:fileId", downloadFile);
router.delete("/:fileId", deleteFile);

export default router;

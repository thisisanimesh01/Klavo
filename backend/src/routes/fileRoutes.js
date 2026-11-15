import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authRequired } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/rateLimiter.js";
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

// Save uploads inside backend/uploads/ with unique timestamp-random keys
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
  },
});

// Allowed safe extensions
const ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".zip"
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const error = new Error(`File type ${ext || "unknown"} is not allowed.`);
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max limit
  fileFilter,
});

// Rate limiter for upload endpoint: max 30 uploads per 10 minutes per IP
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Upload rate limit reached. Please wait before uploading more files.",
});

router.use(authRequired);

// File CRUD APIs
router.post("/upload", uploadLimiter, upload.single("file"), uploadFile);
router.get("/project/:projectId", getProjectFiles);
router.get("/download/:fileId", downloadFile);
router.delete("/:fileId", deleteFile);

export default router;

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authRequired } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/rateLimiter.js";
import { storageService, isSafeSvg } from "../services/storageService.js";
import {
  uploadFile,
  getProjectFiles,
  downloadFile,
  deleteFile,
} from "../controllers/fileController.js";

const router = express.Router();

// Allowed safe extensions and their expected MIME types to prevent MIME spoofing
const ALLOWED_MIME_TYPES = new Map([
  [".png", ["image/png"]],
  [".jpg", ["image/jpeg"]],
  [".jpeg", ["image/jpeg"]],
  [".gif", ["image/gif"]],
  [".webp", ["image/webp"]],
  [".svg", ["image/svg+xml"]],
  [".pdf", ["application/pdf"]],
  [".doc", ["application/msword"]],
  [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
  [".xls", ["application/vnd.ms-excel"]],
  [".xlsx", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]],
  [".csv", ["text/csv", "application/vnd.ms-excel", "text/plain"]],
  [".txt", ["text/plain"]],
  [".zip", ["application/zip", "application/x-zip-compressed"]],
]);

// Use storageService base directory for multer
const uploadDir = storageService.provider.baseDir;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const cleanExt = rawExt.replace(/[^a-z0-9.]/g, "");
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + cleanExt);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // 1. Extension check
  if (!ALLOWED_MIME_TYPES.has(ext)) {
    const error = new Error(`File extension '${ext || "none"}' is not allowed.`);
    error.statusCode = 400;
    return cb(error, false);
  }

  // 2. MIME type verification against expected list
  const validMimes = ALLOWED_MIME_TYPES.get(ext);
  if (!validMimes.includes(file.mimetype.toLowerCase())) {
    const error = new Error(`MIME type '${file.mimetype}' does not match extension '${ext}'. Potential MIME spoofing detected.`);
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

// Post-upload sanitization middleware (SVG content validation & safety check)
const validateUploadedContent = (req, res, next) => {
  if (!req.file) return next();

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext === ".svg") {
    try {
      const buffer = fs.readFileSync(req.file.path);
      if (!isSafeSvg(buffer)) {
        // Clean up dangerous file immediately
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          message: "Malicious or unsafe SVG file detected: script tags or active event handlers are forbidden.",
        });
      }
    } catch (err) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Failed to read SVG file content for safety inspection." });
    }
  }

  next();
};

// Rate limiter for upload endpoint: max 30 uploads per 10 minutes per IP
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Upload rate limit reached. Please wait before uploading more files.",
});

router.use(authRequired);

// File CRUD APIs
router.post("/upload", uploadLimiter, upload.single("file"), validateUploadedContent, uploadFile);
router.get("/project/:projectId", getProjectFiles);
router.get("/download/:fileId", downloadFile);
router.delete("/:fileId", deleteFile);

export default router;

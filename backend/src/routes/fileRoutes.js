// backend/src/routes/fileRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import { authRequired } from "../middleware/authMiddleware.js";

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

// File upload API
router.post("/upload", authRequired, upload.single("file"), (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "No file uploaded" });

  res.json({
    message: "File uploaded successfully",
    file: req.file.filename,
  });
});

export default router;

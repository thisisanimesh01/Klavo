import express from "express";
import multer from "multer";
import path from "path";
import { authRequired } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/rateLimiter.js";
import { storageService } from "../services/storageService.js";
import {
  getUserById,
  updateProfile,
  uploadAvatar,
  serveAvatar,
  changePassword,
} from "../controllers/userController.js";

const router = express.Router();

const uploadDir = storageService.provider.baseDir;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const cleanExt = rawExt.replace(/[^a-z0-9.]/g, "");
    cb(null, "temp-avatar-" + Date.now() + "-" + Math.round(Math.random() * 1e9) + cleanExt);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for avatars
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password change attempts. Please try again later.",
});

// Avatar asset serving (Public with security headers)
router.get("/avatar/:key", serveAvatar);

// Protected routes
router.use(authRequired);

router.get("/me", (req, res) => {
  res.json(req.user);
});

router.put("/profile", updateProfile);
router.post("/avatar", upload.single("avatar"), uploadAvatar);
router.put("/password", passwordLimiter, changePassword);
router.get("/:id", getUserById);

export default router;

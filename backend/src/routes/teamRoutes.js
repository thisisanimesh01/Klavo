import express from "express";
import multer from "multer";
import path from "path";
import { authRequired } from "../middleware/authMiddleware.js";
import { storageService } from "../services/storageService.js";
import {
  createTeam,
  getMyTeams,
  getTeamById,
  updateTeam,
  uploadTeamLogo,
  serveTeamLogo,
  addMemberToTeam,
  updateMemberRole,
  transferOwnership,
  removeMemberFromTeam,
  deleteTeam,
} from "../controllers/teamController.js";

const router = express.Router();

const uploadDir = storageService.provider.baseDir;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const cleanExt = rawExt.replace(/[^a-z0-9.]/g, "");
    cb(null, "temp-logo-" + Date.now() + "-" + Math.round(Math.random() * 1e9) + cleanExt);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for logos
});

// Logo asset serving (Public with security headers)
router.get("/logo/:key", serveTeamLogo);

// Protected routes
router.use(authRequired);

router.post("/", createTeam);
router.get("/my-teams", getMyTeams);
router.get("/:teamId", getTeamById);
router.put("/:teamId", updateTeam);
router.post("/:teamId/logo", upload.single("logo"), uploadTeamLogo);
router.post("/add-member", addMemberToTeam);
router.put("/:teamId/members/:memberId/role", updateMemberRole);
router.post("/:teamId/transfer-ownership", transferOwnership);
router.delete("/:teamId/members/:memberId", removeMemberFromTeam);
router.delete("/:teamId", deleteTeam);

export default router;

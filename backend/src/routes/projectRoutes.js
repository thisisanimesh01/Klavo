import express from "express";
import {
  createProject,
  getProjectById,
  updateProject,
  getProjectsByTeam,
} from "../controllers/projectController.js";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createProject);
router.get("/:id", getProjectById);
router.put("/:id", updateProject);
router.get("/team/:teamId", getProjectsByTeam);

export default router;

// backend/src/routes/projectRoutes.js
import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createProject,
  getProjects,
  deleteProject,
  getProjectMembers,
} from "../controllers/projectController.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createProject);
router.get("/", getProjects);
router.delete("/:projectId", deleteProject);

// ✅ new: get members of the project's team
router.get("/:projectId/members", getProjectMembers);

export default router;

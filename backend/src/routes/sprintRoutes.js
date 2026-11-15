import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createSprint,
  getSprintsByProject,
  getSprintById,
  updateSprint,
  startSprint,
  completeSprint,
  archiveSprint,
  assignTasksToSprint,
  deleteSprint,
} from "../controllers/sprintController.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createSprint);
router.get("/project/:projectId", getSprintsByProject);
router.get("/:sprintId", getSprintById);
router.put("/:sprintId", updateSprint);
router.post("/:sprintId/start", startSprint);
router.post("/:sprintId/complete", completeSprint);
router.post("/:sprintId/archive", archiveSprint);
router.post("/:sprintId/tasks", assignTasksToSprint);
router.delete("/:sprintId", deleteSprint);

export default router;

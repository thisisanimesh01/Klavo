// backend/src/routes/taskRoutes.js
import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createTask,
  getTasksByProject,
  updateTask,
  deleteTask,
  moveTask,
} from "../controllers/taskController.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createTask);
router.get("/project/:projectId", getTasksByProject);
router.put("/:taskId", updateTask);
router.delete("/:taskId", deleteTask);
router.put("/:taskId/move", moveTask);

export default router;

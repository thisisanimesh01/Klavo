import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createTask,
  getTasksByProject,
  getTaskById,
  updateTask,
  deleteTask,
  moveTask,
  bulkUpdateTasks,
  reorderTasks,
} from "../controllers/taskController.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createTask);
router.post("/bulk", bulkUpdateTasks);
router.put("/reorder", reorderTasks);
router.get("/project/:projectId", getTasksByProject);
router.get("/:taskId", getTaskById);
router.put("/:taskId", updateTask);
router.delete("/:taskId", deleteTask);
router.put("/:taskId/move", moveTask);

export default router;

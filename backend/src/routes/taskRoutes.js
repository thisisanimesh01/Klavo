import express from "express";
import {
  createTask,
  getTasksByProject,
  getTaskById,
  updateTask,
  addComment,
  moveTask,
} from "../controllers/taskController.js";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createTask);
router.get("/project/:projectId", getTasksByProject);
router.get("/:id", getTaskById);
router.put("/:id", updateTask);
router.post("/:id/comment", addComment);
router.put("/:id/move", moveTask);

export default router;

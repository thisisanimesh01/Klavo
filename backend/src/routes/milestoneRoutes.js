import express from "express";
import {
  createMilestone,
  getMilestonesByProject,
  getMilestoneById,
  updateMilestone,
  assignTasksToMilestone,
  deleteMilestone,
  getGanttTimeline,
} from "../controllers/milestoneController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Project-level endpoints
router.post("/", protect, createMilestone);
router.get("/project/:projectId", protect, getMilestonesByProject);
router.get("/project/:projectId/gantt", protect, getGanttTimeline);

// Milestone-level endpoints
router.get("/:milestoneId", protect, getMilestoneById);
router.put("/:milestoneId", protect, updateMilestone);
router.delete("/:milestoneId", protect, deleteMilestone);
router.post("/:milestoneId/tasks", protect, assignTasksToMilestone);

export default router;

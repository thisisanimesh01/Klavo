import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  getProjectAnalytics,
  getProjectSprintVelocity,
  getSprintBurndown,
  getTeamWorkloadCapacity,
  getTaskCompletionCycleTime,
  getProjectHealth,
} from "../controllers/analyticsController.js";

const router = express.Router();

router.use(authRequired);

// Project overall analytics (ANL-01)
router.get("/project/:projectId", getProjectAnalytics);

// Sprint velocity comparison across project sprints (ANL-02)
router.get("/project/:projectId/velocity", getProjectSprintVelocity);

// Sprint burndown chart for a specific sprint (ANL-02)
router.get("/sprint/:sprintId/burndown", getSprintBurndown);

// Team Workload & Capacity Analysis (ANL-03)
router.get("/project/:projectId/workload-capacity", getTeamWorkloadCapacity);

// Task Completion & Cycle-Time Metrics (ANL-04)
router.get("/project/:projectId/completion-cycle-time", getTaskCompletionCycleTime);

// Project Health & Progress Indicators (ANL-05)
router.get("/project/:projectId/health", getProjectHealth);

export default router;

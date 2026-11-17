import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  getProjectAnalytics,
  getProjectSprintVelocity,
  getSprintBurndown,
} from "../controllers/analyticsController.js";

const router = express.Router();

router.use(authRequired);

// Project overall analytics
router.get("/project/:projectId", getProjectAnalytics);

// Sprint velocity comparison across project sprints
router.get("/project/:projectId/velocity", getProjectSprintVelocity);

// Sprint burndown chart for a specific sprint
router.get("/sprint/:sprintId/burndown", getSprintBurndown);

export default router;

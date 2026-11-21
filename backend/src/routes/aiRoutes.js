import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  extractTaskFromPrompt,
  suggestTaskBreakdown,
  getProjectSummary,
  getProjectRisks,
  getPrioritizationRecommendations,
  askProjectQuestion,
} from "../controllers/aiController.js";

const router = express.Router();

router.use(authRequired);

// Natural Language Task Extraction
router.post("/extract-task", extractTaskFromPrompt);

// Task Decomposition and Acceptance Criteria Suggestions
router.post("/suggest-breakdown", suggestTaskBreakdown);

// Project Progress Summary & Actionable Insights
router.get("/project-summary/:projectId", getProjectSummary);

// Risk, Overdue, and Dependency Delay Detection
router.get("/project-risks/:projectId", getProjectRisks);

// Intelligent Task Prioritization
router.get("/prioritize/:projectId", getPrioritizationRecommendations);

// Context-Aware Project Q&A
router.post("/ask", askProjectQuestion);

export default router;

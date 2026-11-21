import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createAutomationRule,
  getAutomationRulesByProject,
  updateAutomationRule,
  deleteAutomationRule,
  testAutomationRule,
  triggerScheduledRuleNow,
  getAutomationLogs,
  createRecurringTask,
  getRecurringTasksByProject,
  updateRecurringTask,
  deleteRecurringTask,
  triggerRecurringTaskNow,
} from "../controllers/automationController.js";

const router = express.Router();

router.use(authRequired);

// Automation Rules
router.post("/rules", createAutomationRule);
router.get("/rules/project/:projectId", getAutomationRulesByProject);
router.put("/rules/:ruleId", updateAutomationRule);
router.delete("/rules/:ruleId", deleteAutomationRule);
router.post("/rules/:ruleId/test", testAutomationRule);
router.post("/rules/:ruleId/trigger-schedule", triggerScheduledRuleNow);
router.get("/logs/project/:projectId", getAutomationLogs);

// Recurring Tasks
router.post("/recurring", createRecurringTask);
router.get("/recurring/project/:projectId", getRecurringTasksByProject);
router.put("/recurring/:recurringId", updateRecurringTask);
router.delete("/recurring/:recurringId", deleteRecurringTask);
router.post("/recurring/:recurringId/trigger", triggerRecurringTaskNow);

export default router;

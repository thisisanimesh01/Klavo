import express from "express";
import {
  getProjectWorkflow,
  updateProjectWorkflow,
  resetProjectWorkflow,
} from "../controllers/workflowController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/project/:projectId", protect, getProjectWorkflow);
router.put("/project/:projectId", protect, updateProjectWorkflow);
router.post("/project/:projectId/reset", protect, resetProjectWorkflow);

export default router;

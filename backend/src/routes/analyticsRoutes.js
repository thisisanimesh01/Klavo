import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { getProjectAnalytics } from "../controllers/analyticsController.js";

const router = express.Router();

router.use(authRequired);

router.get("/project/:projectId", getProjectAnalytics);

export default router;

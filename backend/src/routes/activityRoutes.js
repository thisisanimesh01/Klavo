import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  getProjectActivity,
  getMyActivity,
} from "../controllers/activityController.js";

const router = express.Router();

router.use(authRequired);

router.get("/feed", getMyActivity);
router.get("/:projectId", getProjectActivity);

export default router;

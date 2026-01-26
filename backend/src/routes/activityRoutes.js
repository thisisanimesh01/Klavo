
import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { getProjectActivity } from "../controllers/activityController.js";

const router = express.Router();

router.use(authRequired);


router.get("/:projectId", getProjectActivity);

export default router;

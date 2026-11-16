import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createSavedView,
  getSavedViewsByProject,
  getSavedViewById,
  updateSavedView,
  deleteSavedView,
} from "../controllers/savedViewController.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createSavedView);
router.get("/project/:projectId", getSavedViewsByProject);
router.get("/:viewId", getSavedViewById);
router.put("/:viewId", updateSavedView);
router.delete("/:viewId", deleteSavedView);

export default router;

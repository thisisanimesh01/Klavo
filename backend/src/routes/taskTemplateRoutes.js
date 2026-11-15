import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createTaskTemplate,
  getTaskTemplates,
  getTaskTemplateById,
  updateTaskTemplate,
  deleteTaskTemplate,
} from "../controllers/taskTemplateController.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createTaskTemplate);
router.get("/", getTaskTemplates);
router.get("/:templateId", getTaskTemplateById);
router.put("/:templateId", updateTaskTemplate);
router.delete("/:templateId", deleteTaskTemplate);

export default router;

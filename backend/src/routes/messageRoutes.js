import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  getMessagesForProject,
  createMessage,
} from "../controllers/messageController.js";

const router = express.Router();

router.use(authRequired);

// GET messages for a project to which the user has access
router.get("/:projectId", getMessagesForProject);

// POST new message
router.post("/:projectId", createMessage);

export default router;

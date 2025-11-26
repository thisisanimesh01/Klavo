// backend/src/routes/messageRoutes.js
import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  getMessagesForProject,
  createMessage,
} from "../controllers/messageController.js";

const router = express.Router();

router.use(authRequired);

// GET all messages for a project
router.get("/:projectId", getMessagesForProject);

// POST new message
router.post("/:projectId", createMessage);

export default router;

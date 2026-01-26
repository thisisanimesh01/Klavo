import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { addComment, getComments } from "../controllers/commentController.js";

const router = express.Router();

router.use(authRequired);

router.post("/:taskId", addComment);
router.get("/:taskId", getComments);

export default router;

import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { addReaction } from "../controllers/reactionController.js";

const router = express.Router();

router.use(authRequired);

router.post("/:commentId", addReaction);

export default router;

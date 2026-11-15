import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  addReaction,
  getReactions,
  removeReaction,
} from "../controllers/reactionController.js";

const router = express.Router();

router.use(authRequired);

router.post("/:commentId", addReaction);
router.get("/:commentId", getReactions);
router.delete("/:commentId/:emoji", removeReaction);

export default router;

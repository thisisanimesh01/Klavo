import express from "express";
import {
  createTeam,
  getTeamById,
  addMemberToTeam,
  getMyTeams,
} from "../controllers/teamController.js";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

// Protected routes require auth
router.use(authRequired);

router.post("/", createTeam);
router.get("/my-teams", getMyTeams);
router.get("/:id", getTeamById);
router.post("/add-member", addMemberToTeam);

export default router;

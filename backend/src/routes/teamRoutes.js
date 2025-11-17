import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { createTeam, getMyTeams, addMemberToTeam } from "../controllers/teamController.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createTeam);
router.get("/my-teams", getMyTeams);
router.post("/add-member", addMemberToTeam);

export default router;

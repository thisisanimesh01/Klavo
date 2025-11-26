// backend/src/routes/teamRoutes.js
import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createTeam,
  getMyTeams,
  addMemberToTeam,
  deleteTeam,
} from "../controllers/teamController.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createTeam);
router.get("/my-teams", getMyTeams);
router.post("/add-member", addMemberToTeam);
router.delete("/:teamId", deleteTeam);

export default router;



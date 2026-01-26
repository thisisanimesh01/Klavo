import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { getCalendarTasks } from "../controllers/calendarController.js";

const router = express.Router();

router.use(authRequired);

router.get("/", getCalendarTasks);

export default router;

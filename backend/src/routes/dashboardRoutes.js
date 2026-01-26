import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { getDashboardStats } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/", authRequired, getDashboardStats);

export default router;

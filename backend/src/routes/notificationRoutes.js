import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { getMyNotifications, markAsRead } from "../controllers/notificationController.js";

const router = express.Router();

router.use(authRequired);

router.get("/", getMyNotifications);
router.put("/:id", markAsRead);

export default router;

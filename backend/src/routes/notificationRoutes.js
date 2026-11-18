import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getPreferences,
  updatePreferences,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(authRequired);

router.get("/preferences", getPreferences);
router.put("/preferences", updatePreferences);

router.get("/", getMyNotifications);
router.put("/read-all", markAllAsRead);
router.delete("/clear", clearAllNotifications);
router.delete("/:id", deleteNotification);
router.put("/:id", markAsRead);

export default router;

// backend/src/routes/activityRoutes.js
import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

// Protect activity routes
router.use(authRequired);

// Example route — you can expand later
router.get("/", (req, res) => {
  res.json({ message: "Activity logs will be here" });
});

export default router;

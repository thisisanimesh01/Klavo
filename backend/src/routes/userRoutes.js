// backend/src/routes/userRoutes.js
import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", authRequired, (req, res) => {
  res.json(req.user);
});

export default router;

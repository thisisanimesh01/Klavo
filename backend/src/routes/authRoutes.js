// backend/src/routes/authRoutes.js
import express from "express";
import { registerUser, loginUser, getProfile } from "../controllers/authController.js";
import { googleAuthController } from "../controllers/googleAuthController.js";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

// Normal auth
router.post("/register", registerUser);
router.post("/login", loginUser);

// Google auth
router.post("/google", googleAuthController);

// Protected profile route
router.get("/me", authRequired, getProfile);

export default router;

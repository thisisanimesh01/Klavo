import express from "express";
import { registerUser, loginUser, getProfile } from "../controllers/authController.js";
import { googleAuthController } from "../controllers/googleAuthController.js";
import { githubAuthController } from "../controllers/githubAuthController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/rateLimiter.js";
import { clearAuthCookie } from "../utils/cookieHelpers.js";

const router = express.Router();

// Sensitive authentication rate limiter: max 30 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many login/registration attempts. Please try again after 15 minutes.",
});

// Normal email/password auth
router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);

// OAuth Providers
router.post("/google", authLimiter, googleAuthController);
router.post("/github", authLimiter, githubAuthController);

// Protected profile route
router.get("/me", authRequired, getProfile);

// Secure logout endpoint: clears auth cookies if present and confirms termination
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Logged out successfully" });
});

export default router;

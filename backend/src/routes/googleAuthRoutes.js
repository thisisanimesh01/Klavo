// backend/src/routes/googleAuthRoutes.js
import express from "express";
import { googleAuthController } from "../controllers/googleAuthController.js";

const router = express.Router();

router.post("/", googleAuthController);

export default router;

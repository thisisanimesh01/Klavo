import express from "express";
import { User } from "../models/User.js";

const router = express.Router();

// Find user by email (used for adding team members)
router.post("/find", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email }).select("-password");
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

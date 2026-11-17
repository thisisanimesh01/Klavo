import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const authRequired = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader)
      return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1]; // "Bearer token"

    if (!token)
      return res.status(401).json({ message: "Invalid token format" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;

    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

export const protect = authRequired;

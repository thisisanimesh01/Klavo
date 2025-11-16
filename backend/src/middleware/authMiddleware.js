import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const authRequired = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer")) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.userId).select("-password");
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

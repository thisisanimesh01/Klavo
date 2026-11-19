import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";
import { metrics } from "../utils/metrics.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    logger.info("MongoDB connected successfully", {
      host: conn.connection.host,
      name: conn.connection.name,
    });
    return conn;
  } catch (err) {
    metrics.recordDatabaseError(err);
    logger.error("MongoDB connection error", {
      message: err.message,
      name: err.name,
    });
    process.exit(1);
  }
};

export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed cleanly");
  } catch (err) {
    metrics.recordDatabaseError(err);
    logger.error("Error closing MongoDB connection", {
      message: err.message,
    });
  }
};

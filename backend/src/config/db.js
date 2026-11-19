import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";
import { metrics } from "../utils/metrics.js";

/**
 * Production-ready MongoDB connection options.
 * Configures connection pooling, heartbeats, and timeouts.
 */
export const getMongoConnectionOptions = (customEnv = env) => {
  const isProduction = customEnv.isProduction || customEnv.NODE_ENV === "production";
  return {
    autoIndex: !isProduction, // Disable automatic background index builds in production to avoid high write lock overhead
    maxPoolSize: customEnv.MONGO_MAX_POOL_SIZE || 20,
    minPoolSize: customEnv.MONGO_MIN_POOL_SIZE || 2,
    serverSelectionTimeoutMS: customEnv.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000,
    socketTimeoutMS: customEnv.MONGO_SOCKET_TIMEOUT_MS || 45000,
    heartbeatFrequencyMS: 10000,
  };
};

export const connectDB = async (customUri, customOptions = {}) => {
  const uri = customUri || env.MONGO_URI;
  const { noExit, ...mongoDriverOptions } = customOptions;
  const options = {
    ...getMongoConnectionOptions(),
    ...mongoDriverOptions,
  };

  try {
    const conn = await mongoose.connect(uri, options);
    logger.info("MongoDB connected successfully", {
      host: conn.connection.host,
      name: conn.connection.name,
      poolSize: options.maxPoolSize,
    });
    return conn;
  } catch (err) {
    metrics.recordDatabaseError(err);
    logger.error("MongoDB connection error", {
      message: err.message,
      name: err.name,
    });
    if (!noExit) {
      process.exit(1);
    }
    throw err;
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

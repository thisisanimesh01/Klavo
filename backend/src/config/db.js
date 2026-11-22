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

/**
 * Global cache for MongoDB connection in serverless execution environments (e.g., Vercel Functions).
 * Prevents multiple connection pool allocations across warm lambda invocations.
 */
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async (customUri, customOptions = {}) => {
  const uri = customUri || env.MONGO_URI;
  const { noExit, serverless = false, ...mongoDriverOptions } = customOptions;

  // In serverless mode (or when mongoose is already connected), reuse existing active connection
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const currentCache = global.mongoose || cached;
  if (serverless && currentCache.conn) {
    return currentCache.conn;
  }

  const options = {
    ...getMongoConnectionOptions(),
    ...mongoDriverOptions,
  };

  try {
    if (serverless) {
      if (!currentCache.promise) {
        currentCache.promise = mongoose.connect(uri, options).then((m) => m);
      }
      currentCache.conn = await currentCache.promise;
      logger.info("MongoDB connected successfully (serverless cached)", {
        host: currentCache.conn.connection?.host,
        name: currentCache.conn.connection?.name,
      });
      return currentCache.conn;
    }

    const conn = await mongoose.connect(uri, options);
    logger.info("MongoDB connected successfully", {
      host: conn.connection.host,
      name: conn.connection.name,
      poolSize: options.maxPoolSize,
    });
    return conn;
  } catch (err) {
    if (serverless) {
      currentCache.promise = null;
      currentCache.conn = null;
    }
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

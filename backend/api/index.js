import { createApp } from "../src/app.js";
import { connectDB } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { logger } from "../src/utils/logger.js";

/**
 * Lazily initialized Express application instance for serverless invocations.
 * In serverless environments, module-level state persists across warm invocations.
 */
let appInstance = null;

const getApp = () => {
  if (!appInstance) {
    appInstance = createApp();
  }
  return appInstance;
};

/**
 * Vercel Serverless Function Handler
 *
 * Designed specifically for stateless HTTP execution on Vercel Functions:
 * - Lazily connects and reuses cached MongoDB connection.
 * - Dispatches HTTP requests directly to Express app via standard request/response listener.
 * - Does NOT start server.listen(), Socket.IO, Redis TCP clients, or in-memory schedulers.
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 */
export default async function handler(req, res) {
  try {
    // 1. Ensure database connection with serverless connection pooling
    await connectDB(undefined, { serverless: true, noExit: true });

    // 2. Obtain initialized Express application
    const app = getApp();

    // 3. Delegate execution to Express
    return app(req, res);
  } catch (err) {
    logger.error("Vercel Serverless Function error", {
      message: err.message,
      name: err.name,
      stack: err.stack,
    });

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          message: "Internal Serverless Error",
          error: err.message,
          name: err.name,
        })
      );
    }
  }
}

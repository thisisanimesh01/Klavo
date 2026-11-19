import crypto from "crypto";
import { requestContext, logger } from "../utils/logger.js";

/**
 * Middleware establishing request correlation ID via `X-Request-ID` header or crypto.randomUUID.
 * Injects requestId into request object and response headers, and instruments execution
 * within AsyncLocalStorage context.
 */
export const requestCorrelation = (req, res, next) => {
  const incomingId = req.headers["x-request-id"];
  const requestId =
    typeof incomingId === "string" && incomingId.trim().length > 0 && incomingId.length < 128
      ? incomingId.trim()
      : crypto.randomUUID();

  req.id = requestId;
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  requestContext.run({ requestId }, () => {
    next();
  });
};

/**
 * Request access logger emitting structured JSON logs for incoming requests and completions.
 * Logs method, path, status, durationMs, and client IP without capturing sensitive bodies or headers.
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log incoming request at DEBUG level only if debug logging is enabled
  if (logger.shouldLog("DEBUG")) {
    logger.debug("Incoming HTTP request", {
      method: req.method,
      path: req.originalUrl || req.url,
    });
  }

  res.on("finish", () => {
    const level = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";
    if (!logger.shouldLog(level)) return;

    const durationMs = Date.now() - start;
    const context = {
      method: req.method,
      path: req.route?.path || req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      userAgent: req.headers["user-agent"] || null,
      ip: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    };

    if (res.statusCode >= 500) {
      logger.error(`HTTP request completed with server error`, context);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP request completed with client error`, context);
    } else {
      logger.info(`HTTP request completed successfully`, context);
    }
  });

  next();
};

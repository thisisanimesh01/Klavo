import { redisCoordinator } from "../utils/redisCoordinator.js";

/**
 * Distributed and in-memory hybrid sliding window rate limiter middleware.
 * Zero external dependencies. Uses Redis distributed rate limiter when available,
 * with automatic fallback to local memory when running single-instance or when Redis is offline.
 *
 * @param {object} options
 * @param {number} options.windowMs - Window duration in milliseconds (default 60,000ms / 1 min)
 * @param {number} options.max - Max requests per window per IP
 * @param {string} [options.message] - Custom message on rate limit exceeded
 * @returns {import("express").RequestHandler}
 */
export const rateLimit = ({ windowMs = 60 * 1000, max = 100, message = "Too many requests, please try again later." }) => {
  const hits = new Map(); // ip -> [timestamps] (Local fallback store)

  // Periodic cleanup interval (every 2 minutes)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, valid);
      }
    }
  }, Math.max(windowMs, 60000));

  // Allow Node process to exit without waiting on the interval
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return async (req, res, next) => {
    // Determine client IP safely
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown-ip";

    // 1. Attempt distributed rate limiting check via Redis Coordinator
    if (redisCoordinator.connected) {
      try {
        const distributedCheck = await redisCoordinator.checkRateLimit(clientIp, windowMs, max);
        if (distributedCheck !== null) {
          if (!distributedCheck.allowed) {
            const retryAfter = Math.ceil(windowMs / 1000);
            res.setHeader("Retry-After", retryAfter);
            return res.status(429).json({
              message,
              retryAfterSeconds: retryAfter,
            });
          }
          return next();
        }
      } catch {
        // Fall back to local memory if Redis check fails
      }
    }

    // 2. In-memory local sliding window fallback
    const now = Date.now();
    const timestamps = hits.get(clientIp) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        message,
        retryAfterSeconds: retryAfter,
      });
    }

    recent.push(now);
    hits.set(clientIp, recent);
    next();
  };
};

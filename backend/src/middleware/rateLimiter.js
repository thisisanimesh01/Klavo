/**
 * In-memory sliding window rate limiter middleware.
 * Zero external dependencies, self-cleans expired entries to prevent memory growth.
 *
 * @param {object} options
 * @param {number} options.windowMs - Window duration in milliseconds (default 60,000ms / 1 min)
 * @param {number} options.max - Max requests per window per IP
 * @param {string} [options.message] - Custom message on rate limit exceeded
 * @returns {import("express").RequestHandler}
 */
export const rateLimit = ({ windowMs = 60 * 1000, max = 100, message = "Too many requests, please try again later." }) => {
  const hits = new Map(); // ip -> [timestamps]

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

  return (req, res, next) => {
    // Determine client IP safely
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown-ip";

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

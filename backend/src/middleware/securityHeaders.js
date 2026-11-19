/**
 * Global HTTP Security Headers Middleware (REL-03)
 *
 * Enforces industry-standard defense-in-depth HTTP security headers
 * without requiring external npm packages:
 * - Content-Security-Policy (CSP)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 0 (modern standard)
 * - Strict-Transport-Security (HSTS)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: camera=(), microphone=(), geolocation=()
 * - Removal of X-Powered-By
 */
export const securityHeaders = (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking / frame embedding
  res.setHeader("X-Frame-Options", "DENY");

  // Disable buggy legacy browser XSS filters
  res.setHeader("X-XSS-Protection", "0");

  // Strict Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict sensitive browser APIs
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // Enforce HTTPS HSTS when in production or HTTPS request
  if (process.env.NODE_ENV === "production" || req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Remove Express identifier header
  res.removeHeader("X-Powered-By");

  next();
};

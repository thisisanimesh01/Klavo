import { env } from "../config/env.js";

/**
 * Returns standardized, secure cookie options based on current environment.
 *
 * Security attributes:
 * - httpOnly: prevents client-side JavaScript access (XSS defense)
 * - secure: requires HTTPS transmission in production
 * - sameSite: "lax" in production prevents CSRF while permitting top-level navigation
 * - maxAge: defaults to 30 days
 *
 * @param {object} [overrides={}]
 * @returns {object} Express cookie options
 */
export const getSecureCookieOptions = (overrides = {}) => {
  const isCrossOriginProd =
    env.isProduction &&
    env.FRONTEND_URL &&
    !env.FRONTEND_URL.includes("localhost") &&
    env.FRONTEND_URL.startsWith("https://");

  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isCrossOriginProd,
    sameSite: isCrossOriginProd ? "none" : "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    ...overrides,
  };
};

/**
 * Sets the authentication JWT cookie on an Express response.
 *
 * @param {import("express").Response} res
 * @param {string} token - JWT token string
 */
export const setAuthCookie = (res, token) => {
  res.cookie("token", token, getSecureCookieOptions());
};

/**
 * Clears the authentication JWT cookie on logout.
 *
 * @param {import("express").Response} res
 */
export const clearAuthCookie = (res) => {
  res.clearCookie("token", getSecureCookieOptions());
};

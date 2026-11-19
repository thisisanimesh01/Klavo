import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env reliably regardless of current working directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Validates and extracts normalized environment configuration.
 *
 * Safety Invariants:
 * - Differentiates development, test, and production environments.
 * - Never includes or prints secret values in error messages or logs.
 * - Enforces minimum entropy for JWT_SECRET in production (>= 32 chars).
 * - Validates S3 credentials if STORAGE_PROVIDER is set to "s3".
 * - Validates MongoDB connection string scheme.
 *
 * @param {object} [customEnv=process.env] - Target environment object to validate
 * @returns {object} Validated environment configuration object
 */
export const validateEnv = (customEnv = process.env) => {
  const nodeEnv = customEnv.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const isTest = nodeEnv === "test";

  const missing = [];
  const errors = [];

  // Required core variables across all environments
  const requiredVars = ["MONGO_URI", "JWT_SECRET"];
  for (const varName of requiredVars) {
    if (!customEnv[varName] || customEnv[varName].trim() === "") {
      missing.push(varName);
    }
  }

  // Validate Mongo URI scheme
  if (customEnv.MONGO_URI) {
    const uri = customEnv.MONGO_URI.trim();
    if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
      errors.push("MONGO_URI must be a valid mongodb:// or mongodb+srv:// connection URI");
    }
  }

  // Production-specific security validations
  if (isProduction) {
    if (customEnv.JWT_SECRET && customEnv.JWT_SECRET.length < 32) {
      errors.push("JWT_SECRET must be at least 32 characters long in production for cryptographic security");
    }

    if (!customEnv.FRONTEND_URL || customEnv.FRONTEND_URL.trim() === "") {
      missing.push("FRONTEND_URL");
    } else {
      try {
        const parsed = new URL(customEnv.FRONTEND_URL);
        if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
          errors.push("FRONTEND_URL must use HTTPS protocol in production");
        }
      } catch {
        errors.push("FRONTEND_URL must be a valid URL");
      }
    }
  }

  // S3 Persistent Object Storage validation (if enabled)
  const storageProvider = customEnv.STORAGE_PROVIDER || "local";
  if (storageProvider === "s3") {
    const s3Required = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
    for (const varName of s3Required) {
      if (!customEnv[varName] || customEnv[varName].trim() === "") {
        missing.push(varName);
      }
    }
  }

  if (missing.length > 0) {
    errors.push(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  if (errors.length > 0) {
    const errorMsg = `Environment configuration validation failed:\n  - ${errors.join("\n  - ")}`;
    if (!isTest) {
      console.error(`❌ ${errorMsg}`);
    }
    throw new Error(errorMsg);
  }

  return {
    NODE_ENV: nodeEnv,
    isProduction,
    isTest,
    PORT: Number(customEnv.PORT) || 5050,
    MONGO_URI: customEnv.MONGO_URI,
    JWT_SECRET: customEnv.JWT_SECRET,
    FRONTEND_URL: customEnv.FRONTEND_URL || "http://localhost:5173",
    ALLOWED_ORIGINS: customEnv.ALLOWED_ORIGINS
      ? customEnv.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
      : [customEnv.FRONTEND_URL || "http://localhost:5173"],
    GOOGLE_CLIENT_ID: customEnv.GOOGLE_CLIENT_ID || "",
    STORAGE_PROVIDER: storageProvider,
    UPLOADS_DIR: customEnv.UPLOADS_DIR || "uploads",
    S3_BUCKET: customEnv.S3_BUCKET || "",
    S3_REGION: customEnv.S3_REGION || "us-east-1",
    S3_ENDPOINT: customEnv.S3_ENDPOINT || null,
    S3_ACCESS_KEY_ID: customEnv.S3_ACCESS_KEY_ID || "",
    S3_SECRET_ACCESS_KEY: customEnv.S3_SECRET_ACCESS_KEY || "",
    S3_FORCE_PATH_STYLE: customEnv.S3_FORCE_PATH_STYLE !== "false",
    TRUST_PROXY: customEnv.TRUST_PROXY === "true" || isProduction,
    COOKIE_SECURE: customEnv.COOKIE_SECURE === "true" || isProduction,
  };
};

export const env = validateEnv();

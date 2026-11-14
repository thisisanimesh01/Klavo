import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env reliably regardless of working directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Validates that all required environment variables are set.
 * Throws an error listing missing variable names without exposing any values.
 */
export const validateEnv = () => {
  const requiredVars = ["MONGO_URI", "JWT_SECRET"];
  const missing = [];

  for (const varName of requiredVars) {
    if (!process.env[varName] || process.env[varName].trim() === "") {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const errorMsg = `Environment configuration error: Missing required environment variable(s): ${missing.join(", ")}`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  return {
    PORT: process.env.PORT || 5050,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  };
};

export const env = validateEnv();

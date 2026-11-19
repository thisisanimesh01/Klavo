import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { validateEnv } from "../src/config/env.js";
import { getSecureCookieOptions } from "../src/utils/cookieHelpers.js";
import { createApp } from "../src/app.js";
import { dispatchRequest } from "./helpers/testServer.js";
import { runPreflightChecks } from "../src/utils/preflightCheck.js";

describe("REL-06: Production Environment & Secrets Configuration Test Suite", () => {
  describe("Centralized Environment Validation Invariants", () => {
    it("fails cleanly when required MONGO_URI or JWT_SECRET are missing without exposing secrets", () => {
      assert.throws(
        () => validateEnv({ NODE_ENV: "development", JWT_SECRET: "secret" }),
        (err) => {
          assert.ok(err.message.includes("MONGO_URI"));
          assert.ok(!err.message.includes("secret")); // never prints secrets
          return true;
        }
      );

      assert.throws(
        () => validateEnv({ NODE_ENV: "development", MONGO_URI: "mongodb://localhost:27017/db" }),
        (err) => {
          assert.ok(err.message.includes("JWT_SECRET"));
          return true;
        }
      );
    });

    it("rejects invalid MongoDB URI schemes", () => {
      assert.throws(
        () =>
          validateEnv({
            NODE_ENV: "development",
            MONGO_URI: "postgres://user:pass@localhost:5432/db",
            JWT_SECRET: "dev_secret_key_123",
          }),
        /must be a valid mongodb:\/\/ or mongodb\+srv:\/\//
      );
    });

    it("enforces minimum 32-character JWT_SECRET in production mode", () => {
      assert.throws(
        () =>
          validateEnv({
            NODE_ENV: "production",
            MONGO_URI: "mongodb://localhost:27017/klavo_prod",
            JWT_SECRET: "short_insecure_key",
            FRONTEND_URL: "https://app.example.com",
          }),
        /JWT_SECRET must be at least 32 characters long in production/
      );

      // Accepts secure 32+ character key
      const validated = validateEnv({
        NODE_ENV: "production",
        MONGO_URI: "mongodb+srv://cluster.example.mongodb.net/klavo_prod",
        JWT_SECRET: "a_very_long_secure_production_secret_key_exceeding_32_characters",
        FRONTEND_URL: "https://app.example.com",
      });
      assert.equal(validated.isProduction, true);
    });

    it("enforces HTTPS FRONTEND_URL in production mode", () => {
      assert.throws(
        () =>
          validateEnv({
            NODE_ENV: "production",
            MONGO_URI: "mongodb://localhost:27017/klavo_prod",
            JWT_SECRET: "a_very_long_secure_production_secret_key_exceeding_32_characters",
            FRONTEND_URL: "http://insecure-domain.com",
          }),
        /FRONTEND_URL must use HTTPS protocol in production/
      );
    });

    it("enforces required S3 credentials when STORAGE_PROVIDER=s3", () => {
      assert.throws(
        () =>
          validateEnv({
            NODE_ENV: "development",
            MONGO_URI: "mongodb://localhost:27017/db",
            JWT_SECRET: "dev_secret_key_12345",
            STORAGE_PROVIDER: "s3",
          }),
        /Missing required environment variable\(s\): S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY/
      );
    });
  });

  describe("Cookie & HTTPS Security Configuration", () => {
    it("returns secure cookie attributes in production mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const options = getSecureCookieOptions();
      assert.equal(options.httpOnly, true);
      assert.equal(options.path, "/");
      assert.equal(options.sameSite, "lax");

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("CORS Dynamic Origin Resolution", () => {
    it("permits standard localhost requests in development mode", async () => {
      const app = createApp();
      const res = await dispatchRequest(app, {
        method: "OPTIONS",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "POST",
        },
      });
      assert.ok(res.status === 200 || res.status === 204);
    });
  });

  describe("Production Preflight Check Execution", () => {
    it("runs preflight checks successfully in test environment", async () => {
      const report = await runPreflightChecks({ silent: true, skipDbCheck: true });
      assert.equal(report.checks.envConfig.status, "passed");
      assert.equal(report.checks.storage.status, "passed");
      assert.equal(report.checks.database.status, "skipped");
      assert.equal(report.passed, true);
    });
  });

  describe("Frontend Bundle Leakage Audit", () => {
    it("verifies built frontend dist contains zero server secret variable references", () => {
      const distDir = path.resolve("frontend/dist");
      if (!fs.existsSync(distDir)) {
        return; // Skip if dist has not been built yet
      }

      const files = fs.readdirSync(path.join(distDir, "assets"));
      const jsFiles = files.filter((f) => f.endsWith(".js"));

      for (const jsFile of jsFiles) {
        const content = fs.readFileSync(path.join(distDir, "assets", jsFile), "utf8");
        // Ensure sensitive backend environment keys were not injected into frontend bundle
        assert.ok(!content.includes("JWT_SECRET"), `Frontend asset ${jsFile} leaks JWT_SECRET`);
        assert.ok(!content.includes("S3_SECRET_ACCESS_KEY"), `Frontend asset ${jsFile} leaks S3_SECRET_ACCESS_KEY`);
        assert.ok(!content.includes("CLOUDINARY_API_SECRET"), `Frontend asset ${jsFile} leaks CLOUDINARY_API_SECRET`);
      }
    });

    it("ensures .env.example files contain only placeholders without real credentials", () => {
      const backendExample = fs.readFileSync("backend/.env.example", "utf8");
      const frontendExample = fs.readFileSync("frontend/.env.example", "utf8");

      const sensitiveKeywords = ["AKIA", "mongodb+srv://admin:", "password123", "secret_key_live"];
      for (const kw of sensitiveKeywords) {
        assert.ok(!backendExample.includes(kw), `backend/.env.example should not contain real secret: ${kw}`);
        assert.ok(!frontendExample.includes(kw), `frontend/.env.example should not contain real secret: ${kw}`);
      }
    });
  });
});

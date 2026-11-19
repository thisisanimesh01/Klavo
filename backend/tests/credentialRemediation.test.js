import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { validateEnv } from "../src/config/env.js";
import { runSecretScan } from "../../scripts/scan_secrets.js";

describe("SEC-09: Credential Rotation & Secret Remediation Test Suite", () => {
  describe("Strengthened Environment Secret Validation", () => {
    it("rejects insecure default placeholder JWT secrets in production", () => {
      const placeholders = [
        "change_me_to_at_least_32_characters_long_hex_key",
        "replace_with_a_secure_random_64_character_hex_string",
        "default_secret_key_123456789012345",
        "your_jwt_secret_must_be_very_long_indeed",
        "password123_very_long_insecure_jwt_secret",
      ];

      for (const secret of placeholders) {
        assert.throws(
          () =>
            validateEnv({
              NODE_ENV: "production",
              MONGO_URI: "mongodb+srv://cluster.example.net/klavo",
              JWT_SECRET: secret,
              FRONTEND_URL: "https://app.example.com",
            }),
          /insecure default placeholder value/,
          `Should reject placeholder secret: ${secret}`
        );
      }
    });

    it("rejects unpopulated template placeholders in MONGO_URI in production", () => {
      assert.throws(
        () =>
          validateEnv({
            NODE_ENV: "production",
            MONGO_URI: "mongodb+srv://<db_user>:<db_password>@cluster.mongodb.net/klavo",
            JWT_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef",
            FRONTEND_URL: "https://app.example.com",
          }),
        /placeholder template credentials/
      );
    });

    it("accepts high-entropy cryptographic production secrets", () => {
      const valid = validateEnv({
        NODE_ENV: "production",
        MONGO_URI: "mongodb+srv://prod_app_user:e3b0c44298fc1c149afbf4c8996fb924@cluster.mongodb.net/klavo",
        JWT_SECRET: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        FRONTEND_URL: "https://app.example.com",
      });
      assert.equal(valid.isProduction, true);
    });
  });

  describe("Automated Secret Leak Regression Scanner", () => {
    it("verifies zero exposed secrets in tracked repository files", () => {
      const violations = runSecretScan();
      assert.equal(
        violations.length,
        0,
        `Secret scan detected violations: ${JSON.stringify(violations)}`
      );
    });
  });

  describe("Sanitized Template Invariants (.env.example & compose)", () => {
    it("ensures docker-compose.yml uses non-functional placeholder values", () => {
      const composeContent = fs.readFileSync("docker-compose.yml", "utf8");
      assert.ok(composeContent.includes("change_me"));
      assert.ok(!composeContent.includes("AKIA"));
    });

    it("ensures backend and frontend .env.example templates contain zero real credentials", () => {
      const backendExample = fs.readFileSync("backend/.env.example", "utf8");
      const frontendExample = fs.readFileSync("frontend/.env.example", "utf8");

      assert.ok(backendExample.includes("replace_with_a_secure_random"));
      assert.ok(backendExample.includes("<db_user>:<db_password>"));
      assert.ok(frontendExample.includes("your_google_oauth_client_id"));
      assert.ok(!backendExample.includes("AKIA"));
      assert.ok(!frontendExample.includes("AKIA"));
    });
  });
});

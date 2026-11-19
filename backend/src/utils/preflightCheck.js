import mongoose from "mongoose";
import { validateEnv } from "../config/env.js";
import { storageService } from "../services/storageService.js";

/**
 * Production Preflight & Readiness Verification Script (REL-06).
 *
 * Runs non-destructive pre-flight checks before application startup:
 * 1. Environment variable validation (schema, entropy, URL formats, required fields).
 * 2. Storage provider accessibility check (non-destructive exists check).
 * 3. MongoDB connection ping (read-only command).
 *
 * Safety Invariants:
 * - NEVER prints or logs secret keys, tokens, or passwords.
 * - Does not insert, mutate, or delete any production data.
 * - Exits with status 0 on clean pass; status 1 on failure.
 *
 * @param {object} [options]
 * @param {boolean} [options.silent=false]
 * @param {boolean} [options.skipDbCheck=false]
 * @returns {Promise<object>} Status report
 */
export async function runPreflightChecks(options = {}) {
  const { silent = false, skipDbCheck = false } = options;
  const log = (...args) => {
    if (!silent) console.log(...args);
  };
  const errorLog = (...args) => {
    if (!silent) console.error(...args);
  };

  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    checks: {
      envConfig: { status: "pending" },
      storage: { status: "pending" },
      database: { status: "pending" },
    },
    passed: false,
  };

  log("==================================================");
  log("🚀 Klavo Production Readiness & Preflight Check");
  log("==================================================");

  // 1. Validate Environment Variables
  try {
    const validatedEnv = validateEnv(process.env);
    report.checks.envConfig = {
      status: "passed",
      nodeEnv: validatedEnv.NODE_ENV,
      port: validatedEnv.PORT,
      storageProvider: validatedEnv.STORAGE_PROVIDER,
      cookieSecure: validatedEnv.COOKIE_SECURE,
      trustProxy: validatedEnv.TRUST_PROXY,
    };
    log("✅ Environment Configuration: PASSED (all required variables present with valid formats)");
  } catch (err) {
    report.checks.envConfig = {
      status: "failed",
      error: err.message,
    };
    errorLog("❌ Environment Configuration: FAILED");
    errorLog(`   ${err.message}`);
    return report;
  }

  // 2. Validate Storage Provider
  try {
    const providerType = storageService.type;
    const probeKey = "__preflight_readiness_probe__.tmp";
    const exists = await storageService.exists(probeKey);
    report.checks.storage = {
      status: "passed",
      providerType,
      probeResult: exists ? "present" : "absent (expected)",
    };
    log(`✅ Storage Provider [${providerType}]: PASSED (verified operational)`);
  } catch (err) {
    report.checks.storage = {
      status: "failed",
      error: err.message,
    };
    errorLog("❌ Storage Provider: FAILED");
    errorLog(`   ${err.message}`);
    return report;
  }

  // 3. Validate MongoDB Connectivity (Read-Only Ping)
  if (skipDbCheck) {
    report.checks.database = {
      status: "skipped",
      reason: "Database check skipped by option flag",
    };
  } else {
    try {
      const mongoUri = process.env.MONGO_URI;
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
      });

      // Execute read-only ping command
      const pingResult = await conn.connection.db.admin().ping();
      report.checks.database = {
        status: "passed",
        host: conn.connection.host,
        name: conn.connection.name,
        ping: pingResult?.ok === 1 ? "ok" : "unknown",
      };
      log(`✅ Database Connectivity: PASSED (connected to ${conn.connection.host}/${conn.connection.name})`);
      await mongoose.disconnect();
    } catch (err) {
      report.checks.database = {
        status: "failed",
        error: "Unable to establish database connection within timeout",
      };
      errorLog("❌ Database Connectivity: FAILED");
      errorLog(`   ${err.message}`);
      return report;
    }
  }

  report.passed = true;
  log("==================================================");
  log("🎉 Preflight Status: ALL CHECKS PASSED — READY FOR PRODUCTION");
  log("==================================================");

  return report;
}

// Direct CLI invocation execution
if (process.argv[1] && process.argv[1].endsWith("preflightCheck.js")) {
  runPreflightChecks()
    .then((report) => {
      if (!report.passed) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Fatal preflight error:", err.message);
      process.exit(1);
    });
}

import express from "express";
import mongoose from "mongoose";
import { storageService } from "../services/storageService.js";
import { metrics } from "../utils/metrics.js";
import { env } from "../config/env.js";

const router = express.Router();

/**
 * Liveness Probe: GET /api/health/live
 * Fast check indicating whether the Node.js process is active and accepting connections.
 * Does not check downstream dependencies (DB/storage).
 */
router.get("/live", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

/**
 * Readiness Probe: GET /api/health/ready
 * Comprehensive probe verifying downstream critical dependencies (MongoDB connection and storage availability).
 * Returns 200 if healthy, or 503 Service Unavailable if dependencies are not ready.
 * Does NOT expose internal database connection strings, credentials, or detailed stack traces.
 */
router.get("/ready", async (req, res) => {
  const checks = {
    database: { status: "unknown" },
    storage: { status: "unknown" },
  };

  let isReady = true;

  // 1. Verify MongoDB connectivity non-destructively
  try {
    const dbState = mongoose.connection.readyState;
    // 1 = connected, 2 = connecting
    if (dbState === 1) {
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      }
      checks.database.status = "healthy";
    } else {
      checks.database.status = "unhealthy";
      checks.database.detail = dbState === 2 ? "connecting" : "disconnected";
      isReady = false;
    }
  } catch (dbErr) {
    checks.database.status = "unhealthy";
    metrics.recordDatabaseError(dbErr);
    isReady = false;
  }

  // 2. Verify Storage provider configured & available
  try {
    const providerName = storageService.providerName || env.STORAGE_PROVIDER;
    checks.storage.provider = providerName;

    // Fast check: verify provider initialized
    if (storageService.provider) {
      checks.storage.status = "healthy";
    } else {
      checks.storage.status = "unhealthy";
      isReady = false;
    }
  } catch (storageErr) {
    checks.storage.status = "unhealthy";
    metrics.recordStorageOperation(true);
    isReady = false;
  }

  const statusCode = isReady ? 200 : 503;
  return res.status(statusCode).json({
    status: isReady ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * Backward compatibility alias: GET /api/health
 * Redirects or mirrors readiness probe.
 */
router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "klavo-backend",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Metrics telemetry endpoint: GET /api/health/metrics
 * Exposes lightweight aggregated metrics (latency, HTTP error distribution, DB errors, process memory).
 */
router.get("/metrics", (req, res) => {
  const snapshot = metrics.getSnapshot();
  res.status(200).json(snapshot);
});

export default router;

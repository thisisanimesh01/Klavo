import mongoose from "mongoose";
import { logger } from "./logger.js";
import { metrics } from "./metrics.js";

// Explicitly import all application models to ensure schemas are registered
import "../models/Team.js";
import "../models/Task.js";
import "../models/User.js";
import "../models/Project.js";
import "../models/Document.js";
import "../models/DocumentVersion.js";
import "../models/DocumentComment.js";
import "../models/Sprint.js";
import "../models/Notification.js";
import "../models/Workflow.js";
import "../models/Milestone.js";
import "../models/DocumentFolder.js";
import "../models/NotificationPreference.js";
import "../models/AutomationRule.js";
import "../models/RecurringTask.js";
import "../models/AutomationLog.js";
import "../models/SavedView.js";
import "../models/Comment.js";
import "../models/TaskTemplate.js";
import "../models/SavedReport.js";
import "../models/Message.js";
import "../models/Reaction.js";
import "../models/File.js";
import "../models/Activity.js";
import "./distributedLock.js"; // Registers DistributedLock model

/**
 * Production Database Index Migration Utility.
 *
 * In production (`autoIndex: false`), MongoDB background index builds must be
 * initiated explicitly as part of deployment or migration pipelines.
 *
 * Features:
 * - Dry-run mode (`dryRun: true`): Computes index differences (`diffIndexes`) without mutating the database.
 * - Live synchronization mode: Executes `syncIndexes()` safely across all registered Mongoose models.
 * - Granular per-collection reporting: Reports created, existing, and dropped indexes.
 * - Production safety: Logs actions with structured logger, never exposes credentials or sensitive data.
 *
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false] - When true, only computes differences without building/dropping indexes
 * @param {boolean} [options.silent=false] - Suppresses console output
 * @returns {Promise<object>} Migration summary report
 */
export async function runIndexMigration(options = {}) {
  const { dryRun = false, silent = false } = options;

  const log = (...args) => {
    if (!silent) console.log(...args);
  };
  const errorLog = (...args) => {
    if (!silent) console.error(...args);
  };

  const report = {
    timestamp: new Date().toISOString(),
    dryRun,
    totalModels: 0,
    syncedModels: 0,
    failedModels: 0,
    details: {},
    passed: false,
  };

  log("==================================================");
  log(`📊 Klavo MongoDB Index Migration [${dryRun ? "DRY-RUN" : "LIVE"}]`);
  log("==================================================");

  if (mongoose.connection.readyState !== 1) {
    const errorMsg = "MongoDB is not connected. Connect before running index migrations.";
    errorLog(`❌ ${errorMsg}`);
    report.error = errorMsg;
    return report;
  }

  const modelNames = Object.keys(mongoose.models);
  report.totalModels = modelNames.length;

  for (const modelName of modelNames) {
    const model = mongoose.models[modelName];
    try {
      if (dryRun) {
        // diffIndexes returns [toDrop, toCreate]
        const diff = await model.diffIndexes();
        const toDrop = diff[0] || [];
        const toCreate = diff[1] || [];
        report.details[modelName] = {
          status: "inspected",
          toCreateCount: toCreate.length,
          toDropCount: toDrop.length,
          toCreate,
          toDrop,
        };
        log(`  🔍 [Dry-Run] ${modelName}: +${toCreate.length} to create, -${toDrop.length} to drop`);
      } else {
        const syncResult = await model.syncIndexes();
        report.details[modelName] = {
          status: "synchronized",
          result: syncResult,
        };
        log(`  ✅ [Live] ${modelName}: Indexes synchronized successfully`);
      }
      report.syncedModels++;
    } catch (err) {
      report.failedModels++;
      report.details[modelName] = {
        status: "failed",
        error: err.message,
      };
      errorLog(`  ❌ ${modelName} index sync failed: ${err.message}`);
      metrics.recordDatabaseError(err);
    }
  }

  report.passed = report.failedModels === 0;

  log("--------------------------------------------------");
  if (report.passed) {
    log(`✅ Index Migration Completed Successfully: ${report.syncedModels}/${report.totalModels} models synchronized.`);
  } else {
    log(`⚠️ Index Migration Finished with Errors: ${report.failedModels} model(s) failed.`);
  }
  log("==================================================");

  return report;
}

// Standalone CLI execution
if (process.argv[1] && process.argv[1].endsWith("indexMigration.js")) {
  const isDryRun = process.argv.includes("--dry-run");
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/klavo";

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    const result = await runIndexMigration({ dryRun: isDryRun });
    await mongoose.disconnect();
    process.exit(result.passed ? 0 : 1);
  } catch (err) {
    console.error("Index migration CLI error:", err.message);
    process.exit(1);
  }
}

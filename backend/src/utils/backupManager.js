import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

/**
 * Creates a consistent MongoDB backup using mongodump (if available) or JSON collection export fallback.
 *
 * @param {object} options
 * @param {string} [options.outputDir] - Destination directory for backup files
 * @param {string} [options.databaseName] - Explicit target database name
 * @param {boolean} [options.silent=false] - Whether to suppress logging
 * @returns {Promise<{ success: boolean, backupPath: string, collections: string[], timestamp: string }>}
 */
export const runMongoBackup = async (options = {}) => {
  const silent = options.silent || false;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = path.resolve(options.outputDir || path.join(process.cwd(), "backups", `backup-${timestamp}`));

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Ensure database connected
  let db = mongoose.connection.db;
  if (!db && mongoose.connection.readyState !== 1) {
    await mongoose.connect(env.MONGO_URI);
    db = mongoose.connection.db;
  }

  const dbName = options.databaseName || db?.databaseName || "klavo";
  const exportedCollections = [];

  try {
    if (!silent) {
      logger.info(`Starting MongoDB backup for database: ${dbName}`, { targetDir });
    }

    // Attempt mongodump execution if binary exists
    let mongodumpSuccess = false;
    try {
      await execFileAsync("mongodump", [
        `--uri=${env.MONGO_URI}`,
        `--out=${targetDir}`,
        "--gzip",
      ]);
      mongodumpSuccess = true;
    } catch (dumpErr) {
      // Fallback to programmatic collection export (for isolated or binary-less environments)
      if (!silent) {
        logger.warn("mongodump binary unavailable or failed; using resilient JSON collection export fallback", {
          fallback: "json-export",
        });
      }
    }

    if (!mongodumpSuccess) {
      // Export all collections to newline-delimited JSON
      const collections = await db.listCollections().toArray();
      for (const colInfo of collections) {
        const colName = colInfo.name;
        // Skip system collections
        if (colName.startsWith("system.")) continue;

        const col = db.collection(colName);
        const docs = await col.find({}).toArray();
        const filePath = path.join(targetDir, `${colName}.json`);

        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), "utf8");
        exportedCollections.push(colName);
      }
    }

    // Write backup metadata manifest
    const manifest = {
      backupId: `backup-${timestamp}`,
      createdAt: new Date().toISOString(),
      database: dbName,
      strategy: mongodumpSuccess ? "mongodump-gzip" : "json-collection-export",
      collections: exportedCollections,
      targetDir,
    };

    fs.writeFileSync(path.join(targetDir, "backup-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    if (!silent) {
      logger.info("MongoDB backup completed successfully", {
        targetDir,
        collectionsCount: exportedCollections.length,
      });
    }

    return {
      success: true,
      backupPath: targetDir,
      collections: exportedCollections,
      timestamp,
      manifest,
    };
  } catch (err) {
    if (!silent) {
      logger.error("MongoDB backup failed", { message: err.message });
    }
    throw err;
  }
};

/**
 * Validates and restores a database backup into a target database.
 * Strictly rejects restoring directly into a production database unless explicitly confirmed.
 *
 * @param {object} options
 * @param {string} options.backupPath - Path to backup folder containing backup-manifest.json
 * @param {string} [options.targetDbName] - Required isolated target database name
 * @param {boolean} [options.allowProductionRestore=false] - Invariant safety flag
 * @param {boolean} [options.silent=false]
 * @returns {Promise<{ success: boolean, restoredCollections: string[], targetDatabase: string }>}
 */
export const runMongoRestore = async (options = {}) => {
  const silent = options.silent || false;
  const backupPath = path.resolve(options.backupPath);
  const targetDbName = options.targetDbName || "klavo_restore_verification";

  // INVARIANT SAFETY: Never restore directly into production database
  const isProd = process.env.NODE_ENV === "production" || env.isProduction;
  if (isProd && !options.allowProductionRestore) {
    throw new Error(
      "SAFETY VIOLATION: Refusing to run restore operations on production database. Must provide isolated verification target database."
    );
  }

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup path does not exist: ${backupPath}`);
  }

  const manifestFile = path.join(backupPath, "backup-manifest.json");
  if (!fs.existsSync(manifestFile)) {
    throw new Error(`Invalid backup archive: missing backup-manifest.json in ${backupPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const restoredCollections = [];

  try {
    if (!silent) {
      logger.info(`Starting restore verification into target database: ${targetDbName}`, { backupPath });
    }

    // Connect to target DB
    let db = mongoose.connection.useDb(targetDbName);

    // Read and restore each JSON collection from the backup
    const files = fs.readdirSync(backupPath);
    for (const file of files) {
      if (!file.endsWith(".json") || file === "backup-manifest.json") continue;

      const colName = path.basename(file, ".json");
      const content = fs.readFileSync(path.join(backupPath, file), "utf8");
      const docs = JSON.parse(content);

      if (Array.isArray(docs) && docs.length > 0) {
        const targetCol = db.collection(colName);
        // Clean target collection before restore in verification DB
        await targetCol.deleteMany({});
        await targetCol.insertMany(docs);
      }
      restoredCollections.push(colName);
    }

    if (!silent) {
      logger.info("MongoDB restore verification completed successfully", {
        targetDbName,
        restoredCollections,
      });
    }

    return {
      success: true,
      restoredCollections,
      targetDatabase: targetDbName,
      sourceManifest: manifest,
    };
  } catch (err) {
    if (!silent) {
      logger.error("MongoDB restore failed", { message: err.message });
    }
    throw err;
  }
};

// CLI execution helper
if (process.argv[1] && process.argv[1].endsWith("backupManager.js")) {
  const isRestore = process.argv.includes("--restore");
  if (isRestore) {
    const backupPathIndex = process.argv.indexOf("--path");
    const targetPath = backupPathIndex !== -1 ? process.argv[backupPathIndex + 1] : null;
    if (!targetPath) {
      console.error("Usage: node src/utils/backupManager.js --restore --path <backupDir>");
      process.exit(1);
    }
    runMongoRestore({ backupPath: targetPath })
      .then((res) => {
        console.log("Restore verified:", res);
        process.exit(0);
      })
      .catch((err) => {
        console.error("Restore failed:", err.message);
        process.exit(1);
      });
  } else {
    runMongoBackup()
      .then((res) => {
        console.log("Backup complete:", res);
        process.exit(0);
      })
      .catch((err) => {
        console.error("Backup failed:", err.message);
        process.exit(1);
      });
  }
}

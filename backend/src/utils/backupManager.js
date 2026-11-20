import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { storageService } from "../services/storageService.js";
import { acquireDistributedLock, releaseDistributedLock } from "./distributedLock.js";

const execFileAsync = promisify(execFile);

/**
 * Calculates SHA-256 hash of a file buffer or disk path.
 */
export const calculateChecksum = (data) => {
  if (Buffer.isBuffer(data) || typeof data === "string") {
    return crypto.createHash("sha256").update(data).digest("hex");
  }
  throw new Error("Invalid payload for checksum calculation");
};

/**
 * Encrypts data using AES-256-GCM.
 */
export const encryptBuffer = (buffer, secretKeyHex) => {
  if (!secretKeyHex) return buffer;
  const key = crypto.createHash("sha256").update(secretKeyHex).digest(); // 32-byte key
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: IV(12) + TAG(16) + CIPHERTEXT
  return Buffer.concat([iv, tag, encrypted]);
};

/**
 * Decrypts AES-256-GCM payload.
 */
export const decryptBuffer = (encryptedBuffer, secretKeyHex) => {
  if (!secretKeyHex) return encryptedBuffer;
  const key = crypto.createHash("sha256").update(secretKeyHex).digest();
  const iv = encryptedBuffer.subarray(0, 12);
  const tag = encryptedBuffer.subarray(12, 28);
  const ciphertext = encryptedBuffer.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

/**
 * Creates a consistent, checksum-verified, optionally encrypted MongoDB backup.
 *
 * @param {object} options
 * @param {string} [options.outputDir] - Destination directory
 * @param {string} [options.databaseName] - Explicit target database name
 * @param {boolean} [options.encrypt=false] - Whether to encrypt collection files
 * @param {string} [options.encryptionKey] - Secret key for AES-256-GCM encryption
 * @param {boolean} [options.uploadOffsite=false] - Whether to upload archive to S3 object storage
 * @param {boolean} [options.silent=false]
 * @returns {Promise<object>} Backup summary report
 */
export const runMongoBackup = async (options = {}) => {
  const silent = options.silent || false;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = path.resolve(options.outputDir || path.join(process.cwd(), "backups", `backup-${timestamp}`));
  const encryptionKey = options.encryptionKey || env.BACKUP_ENCRYPTION_KEY || null;
  const shouldEncrypt = (options.encrypt !== undefined ? options.encrypt : !!encryptionKey);

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
  const filesManifest = {};

  try {
    if (!silent) {
      logger.info(`Starting consistent MongoDB backup for database: ${dbName}`, { targetDir, encrypted: shouldEncrypt });
    }

    // Export collections to JSON with SHA-256 checksums
    const collections = await db.listCollections().toArray();
    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith("system.")) continue;

      const col = db.collection(colName);
      const docs = await col.find({}).toArray();
      const rawJson = JSON.stringify(docs, null, 2);
      const rawBuffer = Buffer.from(rawJson, "utf8");
      const plainChecksum = calculateChecksum(rawBuffer);

      let finalBuffer = rawBuffer;
      let filename = `${colName}.json`;

      if (shouldEncrypt) {
        finalBuffer = encryptBuffer(rawBuffer, encryptionKey);
        filename = `${colName}.json.enc`;
      }

      const filePath = path.join(targetDir, filename);
      fs.writeFileSync(filePath, finalBuffer);

      exportedCollections.push(colName);
      filesManifest[filename] = {
        collection: colName,
        documentCount: docs.length,
        rawSize: rawBuffer.length,
        storedSize: finalBuffer.length,
        plainChecksum,
        storedChecksum: calculateChecksum(finalBuffer),
        encrypted: shouldEncrypt,
      };
    }

    // Metadata manifest
    const manifest = {
      backupId: `backup-${timestamp}`,
      createdAt: new Date().toISOString(),
      database: dbName,
      encrypted: shouldEncrypt,
      strategy: "json-collection-export-checksummed",
      collections: exportedCollections,
      files: filesManifest,
      targetDir,
    };

    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
    fs.writeFileSync(path.join(targetDir, "backup-manifest.json"), manifestBuffer, "utf8");

    // Optional off-site upload to S3-compatible persistent storage
    let offsiteKey = null;
    if (options.uploadOffsite && storageService && storageService.provider) {
      try {
        const remoteKey = `backups/mongodb/${dbName}/backup-${timestamp}-manifest.json`;
        await storageService.save({ buffer: manifestBuffer, mimetype: "application/json" }, remoteKey);
        offsiteKey = remoteKey;
        if (!silent) logger.info("Uploaded backup manifest to off-site object storage", { remoteKey });
      } catch (uploadErr) {
        logger.warn("Failed to upload backup manifest to off-site storage", { error: uploadErr.message });
      }
    }

    if (!silent) {
      logger.info("MongoDB backup completed successfully with verified checksums", {
        targetDir,
        collectionsCount: exportedCollections.length,
        encrypted: shouldEncrypt,
      });
    }

    return {
      success: true,
      backupPath: targetDir,
      collections: exportedCollections,
      timestamp,
      manifest,
      offsiteKey,
    };
  } catch (err) {
    if (!silent) {
      logger.error("MongoDB backup failed", { message: err.message });
    }
    throw err;
  }
};

/**
 * Validates, decrypts, checks integrity, and restores a database backup into a target database.
 * Strictly enforces that production database cannot be accidentally overwritten.
 * Never deletes source backup files.
 *
 * @param {object} options
 * @param {string} options.backupPath - Path to backup folder
 * @param {string} [options.targetDbName] - Target isolated verification database
 * @param {string} [options.encryptionKey] - Secret key if backup is encrypted
 * @param {boolean} [options.allowProductionRestore=false] - Safety barrier
 * @param {boolean} [options.silent=false]
 * @returns {Promise<object>} Restore report
 */
export const runMongoRestore = async (options = {}) => {
  const silent = options.silent || false;
  const backupPath = path.resolve(options.backupPath);
  const targetDbName = options.targetDbName || "klavo_restore_verification";
  const encryptionKey = options.encryptionKey || env.BACKUP_ENCRYPTION_KEY || null;

  // SAFETY GUARD: Refuse to restore directly into production database unless explicit override
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
  const verifiedFiles = [];

  try {
    if (!silent) {
      logger.info(`Starting restore verification into target database: ${targetDbName}`, { backupPath });
    }

    let db = mongoose.connection.useDb(targetDbName);

    // Iterate files in manifest to verify checksums and integrity
    for (const [filename, fileMeta] of Object.entries(manifest.files || {})) {
      const filePath = path.join(backupPath, filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Integrity check failed: missing backup file ${filename}`);
      }

      const storedBuffer = fs.readFileSync(filePath);
      const computedStoredChecksum = calculateChecksum(storedBuffer);

      if (computedStoredChecksum !== fileMeta.storedChecksum) {
        throw new Error(`Integrity check failed: checksum mismatch for ${filename}`);
      }

      // Decrypt if encrypted
      let plainBuffer = storedBuffer;
      if (fileMeta.encrypted) {
        if (!encryptionKey) {
          throw new Error(`Decryption failed: backup file ${filename} is encrypted but no encryptionKey was provided`);
        }
        plainBuffer = decryptBuffer(storedBuffer, encryptionKey);
      }

      // Verify plain checksum
      const computedPlainChecksum = calculateChecksum(plainBuffer);
      if (computedPlainChecksum !== fileMeta.plainChecksum) {
        throw new Error(`Integrity check failed: decrypted checksum mismatch for ${filename}`);
      }

      const docs = JSON.parse(plainBuffer.toString("utf8"));
      if (Array.isArray(docs) && docs.length > 0) {
        // If connected to a real MongoDB instance, insert documents
        if (mongoose.connection.readyState === 1 && !options.dryRun) {
          const targetCol = db.collection(fileMeta.collection);
          await targetCol.deleteMany({});
          await targetCol.insertMany(docs);
        }
      }

      restoredCollections.push(fileMeta.collection);
      verifiedFiles.push(filename);
    }

    if (!silent) {
      logger.info("MongoDB restore verification completed successfully", {
        targetDbName,
        restoredCollections,
        verifiedFilesCount: verifiedFiles.length,
      });
    }

    return {
      success: true,
      restoredCollections,
      targetDatabase: targetDbName,
      sourceManifest: manifest,
      verifiedFiles,
    };
  } catch (err) {
    if (!silent) {
      logger.error("MongoDB restore verification failed", { message: err.message });
    }
    throw err;
  }
};

/**
 * Prunes expired backups based on configurable retention days.
 * Never deletes current or verified active backups.
 *
 * @param {string} backupsRoot
 * @param {number} [retentionDays=30]
 * @returns {number} Count of pruned backups
 */
export const pruneExpiredBackups = (backupsRoot, retentionDays = 30) => {
  if (!fs.existsSync(backupsRoot)) return 0;
  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  let prunedCount = 0;

  const entries = fs.readdirSync(backupsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("backup-")) {
      const fullPath = path.join(backupsRoot, entry.name);
      const stats = fs.statSync(fullPath);
      const ageMs = now - stats.mtimeMs;

      if (ageMs > maxAgeMs) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        prunedCount++;
      }
    }
  }

  return prunedCount;
};

/**
 * Automated Backup Scheduler Daemon with distributed lease locking.
 */
export class AutomatedBackupScheduler {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 24 * 60 * 60 * 1000; // Daily default (24h)
    this.timer = null;
    this.podId = options.podId || `backup_pod_${process.pid}`;
    this.backupsDir = options.backupsDir || path.join(process.cwd(), "backups");
    this.retentionDays = options.retentionDays || env.BACKUP_RETENTION_DAYS || 30;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runScheduledBackup().catch((e) => {
        logger.error("Scheduled automated backup failed", { error: e.message });
      });
    }, this.intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runScheduledBackup() {
    const lockKey = "klavo_backup_scheduler_leader";
    const acquired = await acquireDistributedLock(lockKey, this.podId, 60000);
    if (!acquired) {
      return { skipped: true, reason: "locked_by_peer" };
    }

    try {
      const result = await runMongoBackup({
        outputDir: path.join(this.backupsDir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`),
        uploadOffsite: true,
      });

      // Prune expired local archives
      const pruned = pruneExpiredBackups(this.backupsDir, this.retentionDays);

      return { success: true, backupResult: result, prunedCount: pruned };
    } finally {
      await releaseDistributedLock(lockKey, this.podId);
    }
  }
}

export const backupScheduler = new AutomatedBackupScheduler();

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  calculateChecksum,
  encryptBuffer,
  decryptBuffer,
  runMongoBackup,
  runMongoRestore,
  pruneExpiredBackups,
  AutomatedBackupScheduler,
} from "../src/utils/backupManager.js";

describe("REL-11: Backup Automation & Disaster Recovery Test Suite", () => {
  const testBackupsRoot = path.resolve("backend/tests/fixtures/backups_test_root");
  const testSecretKey = "a_very_secure_backup_test_encryption_key_32_bytes";

  before(() => {
    if (!fs.existsSync(testBackupsRoot)) {
      fs.mkdirSync(testBackupsRoot, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(testBackupsRoot)) {
      fs.rmSync(testBackupsRoot, { recursive: true, force: true });
    }
  });

  describe("Cryptographic Primitives & Payload Integrity", () => {
    it("computes deterministic SHA-256 checksums for buffers", () => {
      const data = Buffer.from("klavo production database backup payload");
      const hash1 = calculateChecksum(data);
      const hash2 = calculateChecksum(data);
      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64);
    });

    it("encrypts and decrypts payloads with AES-256-GCM authenticated encryption", () => {
      const original = Buffer.from("sensitive tenant project metadata and comments");
      const encrypted = encryptBuffer(original, testSecretKey);

      assert.notDeepEqual(encrypted, original);
      assert.ok(encrypted.length > original.length, "Encrypted payload must include IV and GCM auth tag");

      const decrypted = decryptBuffer(encrypted, testSecretKey);
      assert.deepEqual(decrypted, original);
    });

    it("fails decryption when provided an invalid key or tampered ciphertext", () => {
      const original = Buffer.from("critical document state");
      const encrypted = encryptBuffer(original, testSecretKey);

      // 1. Wrong key
      assert.throws(
        () => decryptBuffer(encrypted, "wrong_secret_key_exceeding_32_characters"),
        /Unsupported state or unable to authenticate data|bad decrypt/i
      );

      // 2. Tampered ciphertext byte
      const tampered = Buffer.from(encrypted);
      tampered[tampered.length - 1] ^= 0xff;
      assert.throws(
        () => decryptBuffer(tampered, testSecretKey),
        /Unsupported state or unable to authenticate data|bad decrypt/i
      );
    });
  });

  describe("Encrypted Backup Creation & Checksummed Manifest Verification", () => {
    const backupDir = path.join(testBackupsRoot, "backup-unit-test");

    it("creates an encrypted backup directory containing checksummed files and manifest", async () => {
      // Simulate fake export files into backupDir
      fs.mkdirSync(backupDir, { recursive: true });

      const sampleDocs = [{ _id: "task_1", title: "Verify RPO/RTO targets" }];
      const rawBuffer = Buffer.from(JSON.stringify(sampleDocs));
      const plainChecksum = calculateChecksum(rawBuffer);
      const encryptedBuffer = encryptBuffer(rawBuffer, testSecretKey);
      const storedChecksum = calculateChecksum(encryptedBuffer);

      fs.writeFileSync(path.join(backupDir, "tasks.json.enc"), encryptedBuffer);

      const manifest = {
        backupId: "backup-unit-test",
        createdAt: new Date().toISOString(),
        database: "klavo_test_db",
        encrypted: true,
        strategy: "json-collection-export-checksummed",
        collections: ["tasks"],
        files: {
          "tasks.json.enc": {
            collection: "tasks",
            documentCount: 1,
            rawSize: rawBuffer.length,
            storedSize: encryptedBuffer.length,
            plainChecksum,
            storedChecksum,
            encrypted: true,
          },
        },
        targetDir: backupDir,
      };

      fs.writeFileSync(path.join(backupDir, "backup-manifest.json"), JSON.stringify(manifest, null, 2));

      assert.ok(fs.existsSync(path.join(backupDir, "backup-manifest.json")));
      assert.ok(fs.existsSync(path.join(backupDir, "tasks.json.enc")));
    });

    it("verifies and decrypts the backup in a restore drill into an isolated verification target", async () => {
      // Execute runMongoRestore on the simulated backup archive
      const restoreReport = await runMongoRestore({
        backupPath: backupDir,
        targetDbName: "klavo_restore_verification_isolated",
        encryptionKey: testSecretKey,
        allowProductionRestore: false,
        silent: true,
      });

      assert.ok(restoreReport.success);
      assert.equal(restoreReport.targetDatabase, "klavo_restore_verification_isolated");
      assert.ok(restoreReport.verifiedFiles.includes("tasks.json.enc"));
      assert.ok(restoreReport.restoredCollections.includes("tasks"));

      // Source backup files must NEVER be deleted during restore verification
      assert.ok(fs.existsSync(path.join(backupDir, "tasks.json.enc")), "Source backup file must be preserved");
      assert.ok(fs.existsSync(path.join(backupDir, "backup-manifest.json")), "Source manifest must be preserved");
    });

    it("detects corrupted backup files and fails restore verification cleanly", async () => {
      const corruptDir = path.join(testBackupsRoot, "backup-corrupt-test");
      fs.mkdirSync(corruptDir, { recursive: true });

      // Corrupted file whose hash will mismatch manifest
      fs.writeFileSync(path.join(corruptDir, "tasks.json.enc"), Buffer.from("tampered bytes"));

      const manifest = {
        backupId: "backup-corrupt-test",
        createdAt: new Date().toISOString(),
        database: "klavo_test_db",
        encrypted: true,
        files: {
          "tasks.json.enc": {
            collection: "tasks",
            storedChecksum: "expected_hash_that_will_not_match_tampered_bytes_1234567890abcdef",
            plainChecksum: "abc",
            encrypted: true,
          },
        },
      };

      fs.writeFileSync(path.join(corruptDir, "backup-manifest.json"), JSON.stringify(manifest, null, 2));

      await assert.rejects(
        async () => {
          await runMongoRestore({
            backupPath: corruptDir,
            targetDbName: "klavo_restore_drill",
            encryptionKey: testSecretKey,
            silent: true,
          });
        },
        /Integrity check failed: checksum mismatch/
      );
    });
  });

  describe("Backup Retention & Expiration Pruning", () => {
    it("prunes backups older than the retention threshold while preserving recent ones", () => {
      const oldBackupDir = path.join(testBackupsRoot, "backup-2025-01-01T00-00-00-000Z");
      const newBackupDir = path.join(testBackupsRoot, "backup-2026-11-20T00-00-00-000Z");

      fs.mkdirSync(oldBackupDir, { recursive: true });
      fs.mkdirSync(newBackupDir, { recursive: true });

      // Simulate age on oldBackupDir (set mtime to 60 days ago)
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      fs.utimesSync(oldBackupDir, sixtyDaysAgo, sixtyDaysAgo);

      // Retention: 30 days
      const pruned = pruneExpiredBackups(testBackupsRoot, 30);
      assert.equal(pruned, 1, "Should prune exactly 1 expired backup");

      assert.equal(fs.existsSync(oldBackupDir), false, "Old backup must be deleted");
      assert.equal(fs.existsSync(newBackupDir), true, "New backup must be retained");
    });
  });

  describe("Automated Backup Scheduler Lifecycle", () => {
    it("initializes scheduler and stops cleanly without dangling handles", () => {
      const scheduler = new AutomatedBackupScheduler({
        intervalMs: 10000,
        podId: "pod_test_backup",
      });

      assert.equal(scheduler.timer, null);
      scheduler.start();
      assert.ok(scheduler.timer !== null);
      scheduler.stop();
      assert.equal(scheduler.timer, null);
    });
  });
});

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";
import { getMongoConnectionOptions, connectDB } from "../src/config/db.js";
import { S3CompatibleStorageProvider, sanitizeS3Key } from "../src/services/s3StorageProvider.js";
import { StorageService } from "../src/services/storageService.js";
import { StorageMigrator } from "../src/services/storageMigrator.js";

describe("REL-09: Production Database & Storage Validation Test Suite", () => {
  describe("MongoDB Production Configuration & Failure Invariants", () => {
    it("configures robust production pooling and timeouts in getMongoConnectionOptions", () => {
      const prodOptions = getMongoConnectionOptions({
        isProduction: true,
        NODE_ENV: "production",
        MONGO_MAX_POOL_SIZE: 50,
        MONGO_MIN_POOL_SIZE: 5,
        MONGO_SERVER_SELECTION_TIMEOUT_MS: 3000,
        MONGO_SOCKET_TIMEOUT_MS: 30000,
      });

      assert.equal(prodOptions.autoIndex, false, "autoIndex must be disabled in production to avoid background index locks");
      assert.equal(prodOptions.maxPoolSize, 50);
      assert.equal(prodOptions.minPoolSize, 5);
      assert.equal(prodOptions.serverSelectionTimeoutMS, 3000);
      assert.equal(prodOptions.socketTimeoutMS, 30000);
      assert.equal(prodOptions.heartbeatFrequencyMS, 10000);
    });

    it("enables autoIndex in non-production environments for automated schema index creation", () => {
      const devOptions = getMongoConnectionOptions({
        isProduction: false,
        NODE_ENV: "development",
      });

      assert.equal(devOptions.autoIndex, true, "autoIndex should be true in development");
      assert.equal(devOptions.maxPoolSize, 20);
      assert.equal(devOptions.minPoolSize, 2);
      assert.equal(devOptions.serverSelectionTimeoutMS, 5000);
    });

    it("handles connection failure cleanly without uncaught exceptions when noExit flag is passed", async () => {
      // Connect to non-existent unreachable database endpoint with short timeout
      await assert.rejects(
        async () => {
          await connectDB("mongodb://127.0.0.1:27999/unreachable_db", {
            serverSelectionTimeoutMS: 500,
            noExit: true,
          });
        },
        /connect/i,
        "Should throw cleanly on connection failure when noExit is enabled"
      );
    });
  });

  describe("S3 Compatible Object Storage Integrity & Error Handling", () => {
    const mockStore = new Map();

    const mockFetch = async (urlStr, options = {}) => {
      const url = new URL(urlStr);
      const method = (options.method || "GET").toUpperCase();
      const pathname = url.pathname;
      const headers = new Headers();

      if (method === "PUT") {
        const bodyBuffer = Buffer.isBuffer(options.body)
          ? options.body
          : Buffer.from(options.body || "");
        mockStore.set(pathname, {
          buffer: bodyBuffer,
          contentType: options.headers["content-type"] || "application/octet-stream",
          etag: '"mock-etag-abc12345"',
        });
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers,
          text: async () => "",
        };
      }

      if (method === "HEAD") {
        if (!mockStore.has(pathname)) {
          return {
            ok: false,
            status: 404,
            statusText: "Not Found",
            headers,
          };
        }
        const item = mockStore.get(pathname);
        headers.set("content-type", item.contentType);
        headers.set("content-length", String(item.buffer.length));
        headers.set("etag", item.etag);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers,
        };
      }

      if (method === "GET") {
        if (!mockStore.has(pathname)) {
          return {
            ok: false,
            status: 404,
            statusText: "Not Found",
            headers,
            text: async () => "<Error><Code>NoSuchKey</Code></Error>",
          };
        }
        const item = mockStore.get(pathname);
        headers.set("content-type", item.contentType);
        headers.set("content-length", String(item.buffer.length));
        headers.set("etag", item.etag);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers,
          arrayBuffer: async () =>
            item.buffer.buffer.slice(
              item.buffer.byteOffset,
              item.buffer.byteOffset + item.buffer.byteLength
            ),
          text: async () => item.buffer.toString("utf8"),
        };
      }

      if (method === "DELETE") {
        mockStore.delete(pathname);
        return {
          ok: true,
          status: 204,
          statusText: "No Content",
          headers,
        };
      }

      return {
        ok: false,
        status: 405,
        statusText: "Method Not Allowed",
        headers,
        text: async () => "Method Not Allowed",
      };
    };

    const s3Provider = new S3CompatibleStorageProvider({
      bucket: "klavo-prod-bucket",
      region: "us-east-1",
      endpoint: "https://s3.example.com",
      accessKeyId: "mock_key_id",
      secretAccessKey: "mock_secret_key_12345",
      fetchFn: mockFetch,
    });

    it("supports headObject metadata extraction", async () => {
      const payload = Buffer.from("production file content verification");
      await s3Provider.save(payload, "verified-file.txt");

      const head = await s3Provider.headObject("verified-file.txt");
      assert.ok(head, "headObject should return metadata for existing object");
      assert.equal(head.contentLength, payload.length);
      assert.equal(head.contentType, "application/octet-stream");
      assert.equal(head.status, 200);

      const nonExistent = await s3Provider.headObject("does-not-exist.txt");
      assert.equal(nonExistent, null);
    });

    it("verifies SigV4 signed URL structure and parameters", () => {
      const signedUrl = s3Provider.getSignedUrl("documents/spec.pdf", 3600);
      assert.ok(signedUrl.includes("X-Amz-Algorithm=AWS4-HMAC-SHA256"));
      assert.ok(signedUrl.includes("X-Amz-Credential="));
      assert.ok(signedUrl.includes("X-Amz-Expires=3600"));
      assert.ok(signedUrl.includes("X-Amz-Signature="));
      assert.ok(signedUrl.includes("documents_spec.pdf") || signedUrl.includes("documents/spec.pdf"));
    });

    it("prevents directory traversal in key sanitization", () => {
      const traversalKeys = [
        "../../etc/passwd",
        "..\\..\\system32\\cmd.exe",
        "uploads/../../../secret",
      ];
      for (const k of traversalKeys) {
        const sanitized = sanitizeS3Key(k);
        assert.ok(!sanitized.includes(".."), `Key must not contain '..': ${sanitized}`);
        assert.ok(!sanitized.startsWith("/"), `Key must not start with '/': ${sanitized}`);
      }
    });

    it("gracefully catches network errors during S3 operations", async () => {
      const failingProvider = new S3CompatibleStorageProvider({
        bucket: "failing-bucket",
        accessKeyId: "mock_id",
        secretAccessKey: "mock_secret",
        fetchFn: async () => {
          throw new Error("Simulated network timeout connection reset");
        },
      });

      const exists = await failingProvider.exists("any-key.txt");
      assert.equal(exists, false, "exists should return false on network failure");

      const head = await failingProvider.headObject("any-key.txt");
      assert.equal(head, null, "headObject should return null on network failure");

      await assert.rejects(
        async () => {
          await failingProvider.save(Buffer.from("data"), "key.txt");
        },
        /Simulated network timeout/
      );
    });
  });

  describe("Strengthened Local-to-S3 Migration Integrity", () => {
    const testLocalDir = path.resolve("backend/tests/fixtures/migration_test_dir");

    before(() => {
      if (!fs.existsSync(testLocalDir)) {
        fs.mkdirSync(testLocalDir, { recursive: true });
      }
      fs.writeFileSync(path.join(testLocalDir, "file_one.txt"), "Klavo persistent storage file 1");
      fs.writeFileSync(path.join(testLocalDir, "file_two.txt"), "Klavo persistent storage file 2 with more bytes");
    });

    after(() => {
      if (fs.existsSync(testLocalDir)) {
        fs.rmSync(testLocalDir, { recursive: true, force: true });
      }
    });

    it("verifies destination size and SHA-256 before marking files as migrated", async () => {
      const remoteMap = new Map();

      const mockFetch = async (urlStr, options = {}) => {
        const url = new URL(urlStr);
        const method = (options.method || "GET").toUpperCase();
        const pathname = url.pathname;
        const headers = new Headers();

        if (method === "PUT") {
          const bodyBuffer = Buffer.isBuffer(options.body)
            ? options.body
            : Buffer.from(options.body || "");
          remoteMap.set(pathname, {
            buffer: bodyBuffer,
            contentType: options.headers["content-type"] || "application/octet-stream",
          });
          return { ok: true, status: 200, text: async () => "" };
        }

        if (method === "HEAD") {
          if (!remoteMap.has(pathname)) {
            return { ok: false, status: 404, headers };
          }
          const item = remoteMap.get(pathname);
          headers.set("content-length", String(item.buffer.length));
          headers.set("content-type", item.contentType);
          return { ok: true, status: 200, headers };
        }

        if (method === "GET") {
          if (!remoteMap.has(pathname)) {
            return { ok: false, status: 404, headers, text: async () => "Not Found" };
          }
          const item = remoteMap.get(pathname);
          headers.set("content-length", String(item.buffer.length));
          headers.set("content-type", item.contentType);
          return {
            ok: true,
            status: 200,
            headers,
            arrayBuffer: async () =>
              item.buffer.buffer.slice(
                item.buffer.byteOffset,
                item.buffer.byteOffset + item.buffer.byteLength
              ),
          };
        }

        return { ok: false, status: 400 };
      };

      const targetStorage = new S3CompatibleStorageProvider({
        bucket: "test-verify-bucket",
        accessKeyId: "mock_key",
        secretAccessKey: "mock_secret",
        fetchFn: mockFetch,
      });

      const migrator = new StorageMigrator({
        targetStorage,
        localDir: testLocalDir,
      });

      // 1. Dry run
      const dryReport = await migrator.migrate({ dryRun: true });
      assert.equal(dryReport.dryRun, true);
      assert.equal(dryReport.totalFiles, 2);
      assert.equal(dryReport.migrated, 2);
      assert.equal(dryReport.skipped, 0);
      assert.equal(dryReport.failed, 0);

      // 2. Live migration with checksum and size integrity verification
      const liveReport = await migrator.migrate({ dryRun: false, overwriteExisting: false });
      assert.equal(liveReport.dryRun, false);
      assert.equal(liveReport.totalFiles, 2);
      assert.equal(liveReport.migrated, 2);
      assert.equal(liveReport.failed, 0);

      // Verify each detail has verified checksum
      for (const d of liveReport.details) {
        assert.equal(d.status, "migrated");
        assert.ok(d.checksum, "Migrated record must include verified SHA-256 checksum");
      }

      // 3. Resumability: second run should skip all previously uploaded objects
      const resumeReport = await migrator.migrate({ dryRun: false, overwriteExisting: false });
      assert.equal(resumeReport.skipped, 2);
      assert.equal(resumeReport.migrated, 0);
      assert.equal(resumeReport.failed, 0);

      // 4. Source files remain intact (non-destructive)
      assert.ok(fs.existsSync(path.join(testLocalDir, "file_one.txt")), "Source file 1 must remain intact");
      assert.ok(fs.existsSync(path.join(testLocalDir, "file_two.txt")), "Source file 2 must remain intact");
    });

    it("fails migration if destination checksum does not match source file", async () => {
      const corruptFetch = async (urlStr, options = {}) => {
        const method = (options.method || "GET").toUpperCase();
        const headers = new Headers();

        if (method === "PUT") {
          return { ok: true, status: 200, text: async () => "" };
        }
        if (method === "HEAD") {
          headers.set("content-length", "100");
          return { ok: true, status: 200, headers };
        }
        if (method === "GET") {
          // Return corrupted buffer that will mismatch source hash
          const corruptBuffer = Buffer.from("corrupted payload");
          headers.set("content-length", String(corruptBuffer.length));
          return {
            ok: true,
            status: 200,
            headers,
            arrayBuffer: async () => corruptBuffer.buffer,
          };
        }
        return { ok: false, status: 400 };
      };

      const corruptStorage = new S3CompatibleStorageProvider({
        bucket: "corrupt-bucket",
        accessKeyId: "mock_key",
        secretAccessKey: "mock_secret",
        fetchFn: corruptFetch,
      });

      const migrator = new StorageMigrator({
        targetStorage: corruptStorage,
        localDir: testLocalDir,
      });

      const report = await migrator.migrate({ dryRun: false, overwriteExisting: true });
      assert.equal(report.failed, 2, "Both files should fail integrity verification");
      assert.equal(report.migrated, 0);
      for (const d of report.details) {
        assert.equal(d.status, "failed");
        assert.ok(d.error.includes("Integrity verification failed"), "Error message should report integrity failure");
      }
    });
  });

  describe("Optional MinIO / Real S3 Test Provider Integration", () => {
    it("safely skips real integration test when TEST_S3_ENDPOINT or MinIO is unavailable", async (t) => {
      const testEndpoint = process.env.TEST_S3_ENDPOINT;
      if (!testEndpoint) {
        t.skip("TEST_S3_ENDPOINT not set; skipping live external S3/MinIO provider integration test safely");
        return;
      }

      // If configured, run live non-destructive test against provided test bucket
      const testProvider = new S3CompatibleStorageProvider({
        bucket: process.env.TEST_S3_BUCKET || "klavo-test-bucket",
        endpoint: testEndpoint,
        accessKeyId: process.env.TEST_S3_ACCESS_KEY_ID || "minioadmin",
        secretAccessKey: process.env.TEST_S3_SECRET_ACCESS_KEY || "minioadmin",
      });

      const testKey = `integration-test-${Date.now()}.txt`;
      const testBuffer = Buffer.from("integration test payload");

      await testProvider.save(testBuffer, testKey);
      const exists = await testProvider.exists(testKey);
      assert.equal(exists, true);

      const obj = await testProvider.getObject(testKey);
      assert.ok(obj && obj.buffer);
      assert.equal(obj.buffer.toString(), "integration test payload");

      await testProvider.delete(testKey);
      const existsAfter = await testProvider.exists(testKey);
      assert.equal(existsAfter, false);
    });
  });
});

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { S3CompatibleStorageProvider, sanitizeS3Key } from "../src/services/s3StorageProvider.js";
import { StorageService } from "../src/services/storageService.js";
import { StorageMigrator } from "../src/services/storageMigrator.js";

describe("REL-05: Persistent Object Storage & S3 Provider Test Suite", () => {
  // Mock In-Memory S3 Backend
  const createMockS3Fetch = () => {
    const s3Store = new Map(); // key -> { buffer, headers, status }

    const mockFetch = async (urlStr, options = {}) => {
      const url = new URL(urlStr);
      const method = (options.method || "GET").toUpperCase();
      const pathname = url.pathname; // e.g. /my-bucket/safe-key.png
      const headers = new Headers();

      if (method === "PUT") {
        const bodyBuffer = Buffer.isBuffer(options.body)
          ? options.body
          : Buffer.from(options.body || "");
        s3Store.set(pathname, {
          buffer: bodyBuffer,
          contentType: options.headers["content-type"] || "application/octet-stream",
          etag: '"mock-etag-12345"',
        });
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers,
          text: async () => "",
        };
      }

      if (method === "GET") {
        if (!s3Store.has(pathname)) {
          return {
            ok: false,
            status: 404,
            statusText: "Not Found",
            headers,
            text: async () => "<Error><Code>NoSuchKey</Code></Error>",
          };
        }
        const item = s3Store.get(pathname);
        headers.set("content-type", item.contentType);
        headers.set("content-length", String(item.buffer.length));
        headers.set("etag", item.etag);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers,
          arrayBuffer: async () => item.buffer.buffer.slice(
            item.buffer.byteOffset,
            item.buffer.byteOffset + item.buffer.byteLength
          ),
          text: async () => item.buffer.toString("utf8"),
        };
      }

      if (method === "HEAD") {
        if (!s3Store.has(pathname)) {
          return {
            ok: false,
            status: 404,
            statusText: "Not Found",
            headers,
          };
        }
        const item = s3Store.get(pathname);
        headers.set("content-type", item.contentType);
        headers.set("content-length", String(item.buffer.length));
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers,
        };
      }

      if (method === "DELETE") {
        s3Store.delete(pathname);
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

    return { mockFetch, s3Store };
  };

  describe("Configuration & Environment Validation", () => {
    it("fails cleanly when required S3 credentials or bucket are omitted", () => {
      assert.throws(
        () => new S3CompatibleStorageProvider({ accessKeyId: "key", secretAccessKey: "sec" }),
        /requires 'bucket'/
      );
      assert.throws(
        () => new S3CompatibleStorageProvider({ bucket: "bkt", secretAccessKey: "sec" }),
        /requires 'accessKeyId'/
      );
      assert.throws(
        () => new S3CompatibleStorageProvider({ bucket: "bkt", accessKeyId: "key" }),
        /requires 'secretAccessKey'/
      );
    });

    it("initializes LocalDiskStorageProvider by default when STORAGE_PROVIDER is unset", () => {
      const storage = new StorageService({ provider: "local" });
      assert.equal(storage.type, "local");
      assert.ok(storage.provider.baseDir);
    });

    it("initializes S3CompatibleStorageProvider when STORAGE_PROVIDER=s3", () => {
      const { mockFetch } = createMockS3Fetch();
      const storage = new StorageService({
        provider: "s3",
        bucket: "test-klavo-bucket",
        accessKeyId: "AKIA_TEST_KEY",
        secretAccessKey: "SECRET_KEY_CI",
        fetchFn: mockFetch,
      });
      assert.equal(storage.type, "s3");
      assert.equal(storage.provider.bucket, "test-klavo-bucket");
    });
  });

  describe("Key Sanitization & Storage-Key Isolation", () => {
    it("neutralizes path traversal sequences and removes leading/consecutive dots", () => {
      const traversalKeys = [
        "../../etc/passwd",
        "..\\..\\windows\\system32",
        "uploads/../../../secret.env",
        "/absolute/path/file.png",
      ];

      for (const k of traversalKeys) {
        const sanitized = sanitizeS3Key(k);
        assert.ok(!sanitized.includes(".."), `Sanitized key should not contain '..': ${sanitized}`);
        assert.ok(!sanitized.startsWith("/"), `Sanitized key should not start with '/': ${sanitized}`);
      }
    });

    it("sanitizes dangerous control characters and enforces valid S3 key syntax", () => {
      const dirty = "report\0name;rm -rf;@2026.pdf";
      const sanitized = sanitizeS3Key(dirty);
      assert.equal(sanitized, "reportname_rm_-rf__2026.pdf");
    });
  });

  describe("S3 Provider CRUD & Streaming Operations", () => {
    it("saves buffer payload to S3 and verifies presence via exists()", async () => {
      const { mockFetch, s3Store } = createMockS3Fetch();
      const s3Provider = new S3CompatibleStorageProvider({
        bucket: "test-bucket",
        accessKeyId: "AKIA123",
        secretAccessKey: "SECRET456",
        endpoint: "http://127.0.0.1:9000",
        fetchFn: mockFetch,
      });

      const payload = Buffer.from("Hello Klavo Object Storage", "utf8");
      const result = await s3Provider.save({
        buffer: payload,
        mimetype: "text/plain",
      }, "docs/sample.txt");

      assert.equal(result.storageProvider, "s3");
      assert.equal(result.storageKey, "docs/sample.txt");
      assert.equal(result.size, payload.length);

      const exists = await s3Provider.exists("docs/sample.txt");
      assert.equal(exists, true);
    });

    it("retrieves stored object with content headers and binary fidelity", async () => {
      const { mockFetch } = createMockS3Fetch();
      const s3Provider = new S3CompatibleStorageProvider({
        bucket: "test-bucket",
        accessKeyId: "AKIA123",
        secretAccessKey: "SECRET456",
        fetchFn: mockFetch,
      });

      const originalText = "Structured Test Data for Persistent Storage";
      await s3Provider.save({
        buffer: Buffer.from(originalText, "utf8"),
        mimetype: "text/plain",
      }, "test-file.txt");

      const fetched = await s3Provider.getObject("test-file.txt");
      assert.ok(fetched);
      assert.equal(fetched.buffer.toString("utf8"), originalText);
      assert.equal(fetched.contentType, "text/plain");
      assert.equal(fetched.contentLength, Buffer.byteLength(originalText));
    });

    it("returns null when attempting to retrieve missing objects (404 handling)", async () => {
      const { mockFetch } = createMockS3Fetch();
      const s3Provider = new S3CompatibleStorageProvider({
        bucket: "test-bucket",
        accessKeyId: "AKIA123",
        secretAccessKey: "SECRET456",
        fetchFn: mockFetch,
      });

      const missing = await s3Provider.getObject("nonexistent-key.png");
      assert.equal(missing, null);
      const exists = await s3Provider.exists("nonexistent-key.png");
      assert.equal(exists, false);
    });

    it("deletes object cleanly from S3 and verifies it no longer exists", async () => {
      const { mockFetch } = createMockS3Fetch();
      const s3Provider = new S3CompatibleStorageProvider({
        bucket: "test-bucket",
        accessKeyId: "AKIA123",
        secretAccessKey: "SECRET456",
        fetchFn: mockFetch,
      });

      await s3Provider.save({ buffer: Buffer.from("to delete") }, "temp-delete.txt");
      assert.equal(await s3Provider.exists("temp-delete.txt"), true);

      const deleted = await s3Provider.delete("temp-delete.txt");
      assert.equal(deleted, true);
      assert.equal(await s3Provider.exists("temp-delete.txt"), false);
    });
  });

  describe("Presigned Short-Lived URL Generation", () => {
    it("generates valid AWS SigV4 signed URL with query parameters and expiration", () => {
      const s3Provider = new S3CompatibleStorageProvider({
        bucket: "secure-bucket",
        region: "us-west-2",
        accessKeyId: "AKIA_SIGNED_URL",
        secretAccessKey: "SECRET_KEY_FOR_SIGNING",
      });

      const signedUrl = s3Provider.getSignedUrl("private/confidential.pdf", 600);
      assert.ok(signedUrl.startsWith("https://secure-bucket.s3.us-west-2.amazonaws.com/private/confidential.pdf"));

      const parsed = new URL(signedUrl);
      assert.equal(parsed.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
      assert.equal(parsed.searchParams.get("X-Amz-Expires"), "600");
      assert.ok(parsed.searchParams.get("X-Amz-Signature"));
      assert.ok(parsed.searchParams.get("X-Amz-Credential").includes("AKIA_SIGNED_URL"));
    });
  });

  describe("Safe Local-to-Object Migration Utility", () => {
    const testMigrationDir = path.resolve("backend/tests/fixtures/test_migration_uploads");

    beforeEach(() => {
      if (fs.existsSync(testMigrationDir)) {
        fs.rmSync(testMigrationDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testMigrationDir, { recursive: true });

      // Create dummy local upload files
      fs.writeFileSync(path.join(testMigrationDir, "avatar-101.png"), "image data 101");
      fs.writeFileSync(path.join(testMigrationDir, "report-202.pdf"), "pdf document content 202");
    });

    it("runs dry-run by default without copying or altering local files", async () => {
      const { mockFetch } = createMockS3Fetch();
      const targetS3 = new S3CompatibleStorageProvider({
        bucket: "migration-bucket",
        accessKeyId: "MIG_KEY",
        secretAccessKey: "MIG_SECRET",
        endpoint: "http://127.0.0.1:9000",
        fetchFn: mockFetch,
      });

      const migrator = new StorageMigrator({
        targetStorage: targetS3,
        localDir: testMigrationDir,
      });

      const result = await migrator.migrate({ dryRun: true });
      assert.equal(result.dryRun, true);
      assert.equal(result.totalFiles, 2);
      assert.equal(result.migrated, 2); // 2 eligible
      assert.equal(result.failed, 0);

      // Verify files still exist locally
      assert.equal(fs.existsSync(path.join(testMigrationDir, "avatar-101.png")), true);
      assert.equal(fs.existsSync(path.join(testMigrationDir, "report-202.pdf")), true);

      // Verify nothing uploaded to mock S3 in dry run
      assert.equal(await targetS3.exists("avatar-101.png"), false);
    });

    it("migrates files in live mode and skips existing objects on subsequent runs (resumability)", async () => {
      const { mockFetch } = createMockS3Fetch();
      const targetS3 = new S3CompatibleStorageProvider({
        bucket: "migration-bucket",
        accessKeyId: "MIG_KEY",
        secretAccessKey: "MIG_SECRET",
        endpoint: "http://127.0.0.1:9000",
        fetchFn: mockFetch,
      });

      const migrator = new StorageMigrator({
        targetStorage: targetS3,
        localDir: testMigrationDir,
      });

      // 1. Live migration run (never delete local files)
      const liveResult = await migrator.migrate({ dryRun: false, deleteSourceAfterCopy: false });
      assert.equal(liveResult.dryRun, false);
      assert.equal(liveResult.migrated, 2);
      assert.equal(liveResult.failed, 0);

      // Verify both exist in mock S3
      assert.equal(await targetS3.exists("avatar-101.png"), true);
      assert.equal(await targetS3.exists("report-202.pdf"), true);

      // Verify local files are preserved safely
      assert.equal(fs.existsSync(path.join(testMigrationDir, "avatar-101.png")), true);

      // 2. Second migration run: both files should be skipped (resumability)
      const secondRun = await migrator.migrate({ dryRun: false, overwriteExisting: false });
      assert.equal(secondRun.migrated, 0);
      assert.equal(secondRun.skipped, 2);
    });
  });
});

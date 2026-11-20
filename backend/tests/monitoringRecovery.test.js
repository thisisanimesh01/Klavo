import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import http from "http";
import mongoose from "mongoose";
import { redact, redactString, logger, StructuredLogger, LogLevel, requestContext } from "../src/utils/logger.js";
import { metrics, MetricsRegistry } from "../src/utils/metrics.js";
import { createApp } from "../src/app.js";
import { runMongoBackup, runMongoRestore, calculateChecksum } from "../src/utils/backupManager.js";

describe("REL-07: Monitoring, Logging, Backups & Recovery Test Suite", () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe("Structured JSON Logging & Secret Redaction", () => {
    it("redacts sensitive keys including passwords, tokens, JWTs, cookies, and Mongo URIs", () => {
      const sensitivePayload = {
        username: "developer_user",
        password: "SuperSecretPassword123!",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyPayload.dummySignature",
        jwtSecret: "production_cryptographic_secret_key",
        cookie: "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        s3SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        mongoUri: "mongodb://app_user:ultra_secure_pass@cluster.mongodb.net/klavo_prod",
        safeMetadata: {
          workspaceId: "ws_12345",
          projectId: "proj_67890",
        },
      };

      const sanitized = redact(sensitivePayload);

      assert.equal(sanitized.username, "developer_user");
      assert.equal(sanitized.password, "[REDACTED]");
      assert.equal(sanitized.token, "[REDACTED]");
      assert.equal(sanitized.jwtSecret, "[REDACTED]");
      assert.equal(sanitized.cookie, "[REDACTED]");
      assert.equal(sanitized.authorization, "[REDACTED]");
      assert.equal(sanitized.s3SecretAccessKey, "[REDACTED]");
      assert.equal(sanitized.mongoUri, "[REDACTED]");
      assert.equal(sanitized.safeMetadata.workspaceId, "ws_12345");
      assert.equal(sanitized.safeMetadata.projectId, "proj_67890");
    });

    it("redacts credentials embedded directly within string messages and Bearer tokens", () => {
      const logMessage = "Failed connecting to mongodb+srv://admin_root:supersecret123@prod-cluster.net/klavo with auth Bearer abcdef123456";
      const cleaned = redactString(logMessage);

      assert.ok(!cleaned.includes("supersecret123"), "Should not contain raw password");
      assert.ok(!cleaned.includes("abcdef123456"), "Should not contain raw Bearer token");
      assert.ok(cleaned.includes("[REDACTED]:[REDACTED]@"));
      assert.ok(cleaned.includes("Bearer [REDACTED]"));
    });

    it("avoids logging collaborative document contents and raw buffers", () => {
      const documentEditPayload = {
        documentId: "doc_999",
        content: "Top secret proprietary strategy document details and numbers",
        yjsUpdate: "AwFwaW5nAQ==",
        buffer: Buffer.from("raw file binary data"),
      };

      const redacted = redact(documentEditPayload);
      assert.equal(redacted.documentId, "doc_999");
      assert.equal(redacted.content, "[REDACTED]");
      assert.equal(redacted.yjsUpdate, "[REDACTED]");
      assert.match(redacted.buffer, /\[Buffer: \d+ bytes\]/);
    });

    it("emits structured JSON logs containing timestamp, severity, environment, and requestId", () => {
      const logEntries = [];
      const mockStream = {
        write: (str) => {
          logEntries.push(JSON.parse(str.trim()));
        },
      };

      const customLogger = new StructuredLogger({
        service: "test-service",
        minLevel: "DEBUG",
        stream: mockStream,
        errorStream: mockStream,
      });

      requestContext.run({ requestId: "req-trace-abc-123" }, () => {
        customLogger.info("Operation completed successfully", { itemCount: 42 });
      });

      assert.equal(logEntries.length, 1);
      const entry = logEntries[0];
      assert.equal(entry.service, "test-service");
      assert.equal(entry.severity, "INFO");
      assert.equal(entry.requestId, "req-trace-abc-123");
      assert.equal(entry.message, "Operation completed successfully");
      assert.equal(entry.context.itemCount, 42);
      assert.ok(entry.timestamp);
    });
  });

  describe("Request Correlation & Tracing", () => {
    it("assigns and echoes X-Request-ID response header if client provided one", async () => {
      const clientTraceId = "trace-client-custom-999";
      const res = await fetch(`${baseUrl}/api/health/live`, {
        headers: { "X-Request-ID": clientTraceId },
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("x-request-id"), clientTraceId);
      const body = await res.json();
      assert.equal(body.status, "ok");
    });

    it("generates crypto UUID X-Request-ID response header if client did not supply one", async () => {
      const res = await fetch(`${baseUrl}/api/health/live`);

      assert.equal(res.status, 200);
      const traceHeader = res.headers.get("x-request-id");
      assert.ok(traceHeader, "Should generate an X-Request-ID header");
      assert.match(
        traceHeader,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        "Should be valid UUID"
      );
    });
  });

  describe("Health & Readiness Endpoints (/api/health)", () => {
    it("GET /api/health/live returns fast 200 process liveness check", async () => {
      const res = await fetch(`${baseUrl}/api/health/live`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, "ok");
      assert.ok(typeof data.uptime === "number");
    });

    it("GET /api/health/ready returns service readiness status and checks without credentials", async () => {
      const res = await fetch(`${baseUrl}/api/health/ready`);
      // Status code may be 200 (if mongod is reachable) or 503 (if disconnected), but structure is strictly valid
      const data = await res.json();
      assert.ok(res.status === 200 || res.status === 503);
      assert.ok(data.checks);
      assert.ok(data.checks.database);
      assert.ok(data.checks.storage);
      // Ensure no raw passwords or URIs in checks
      const serialized = JSON.stringify(data);
      assert.ok(!serialized.includes("mongodb://"), "Health endpoint must not expose DB connection URIs");
      assert.ok(!serialized.includes("password"), "Health endpoint must not expose passwords");
    });

    it("GET /api/health/metrics provides non-sensitive aggregated operational telemetry", async () => {
      const res = await fetch(`${baseUrl}/api/health/metrics`);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.ok(data.http);
      assert.ok(data.http.totalRequests >= 1);
      assert.ok(data.http.latency);
      assert.ok(data.process.memory);
      assert.ok(data.database);
      assert.ok(data.storage);
      assert.ok(data.socketIO);
      assert.ok(data.automations);
    });
  });

  describe("Monitoring Metrics Instrumentation", () => {
    it("records latencies, status distributions, and database error counts correctly", () => {
      const testRegistry = new MetricsRegistry();

      testRegistry.recordHttpRequest("GET", 200, 25);
      testRegistry.recordHttpRequest("POST", 201, 75);
      testRegistry.recordHttpRequest("GET", 404, 15);
      testRegistry.recordHttpRequest("POST", 500, 350);

      testRegistry.recordDatabaseError(new Error("Connection timeout"));
      testRegistry.recordSocketConnect();
      testRegistry.recordSocketConnect();
      testRegistry.recordSocketDisconnect();
      testRegistry.recordAutomationExecution(true);

      const snapshot = testRegistry.getSnapshot();

      assert.equal(snapshot.http.totalRequests, 4);
      assert.equal(snapshot.http.statusCodes["2xx"], 2);
      assert.equal(snapshot.http.statusCodes["4xx"], 1);
      assert.equal(snapshot.http.statusCodes["5xx"], 1);
      assert.equal(snapshot.database.errorCount, 1);
      assert.equal(snapshot.socketIO.activeConnections, 1);
      assert.equal(snapshot.automations.failureCount, 1);
      assert.ok(snapshot.http.latency.avgMs > 0);
    });
  });

  describe("MongoDB Backup & Isolated Restore Verification Tooling", () => {
    const testBackupDir = path.resolve(process.cwd(), "test_backups_rel07");

    after(() => {
      if (fs.existsSync(testBackupDir)) {
        fs.rmSync(testBackupDir, { recursive: true, force: true });
      }
    });

    it("creates a consistent backup manifest and export archive safely", async () => {
      // Connect in-memory or fallback
      if (mongoose.connection.readyState !== 1) {
        try {
          await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/klavo");
        } catch {
          // If mongod not available in sandboxed test run, skip live DB test
          return;
        }
      }

      const backupResult = await runMongoBackup({
        outputDir: testBackupDir,
        databaseName: "klavo_test_backup",
        silent: true,
      });

      assert.ok(backupResult.success);
      assert.ok(fs.existsSync(path.join(testBackupDir, "backup-manifest.json")));

      const manifestContent = JSON.parse(
        fs.readFileSync(path.join(testBackupDir, "backup-manifest.json"), "utf8")
      );
      assert.equal(manifestContent.database, "klavo_test_backup");
      assert.ok(manifestContent.createdAt);
    });

    it("refuses to restore into production databases without explicit safety bypass", async () => {
      // Force isProduction
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      try {
        await assert.rejects(
          async () => {
            await runMongoRestore({
              backupPath: testBackupDir,
              targetDbName: "production",
              allowProductionRestore: false,
              silent: true,
            });
          },
          /SAFETY VIOLATION/,
          "Should refuse to run restore on production database"
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it("verifies restore safely into an isolated non-production verification database", async () => {
      if (mongoose.connection.readyState !== 1) return;

      // Seed a small mock file into testBackupDir and update manifest so restore recognizes it
      const sampleBuffer = Buffer.from(JSON.stringify([{ _id: "item1", name: "Sample Item" }]), "utf8");
      fs.writeFileSync(path.join(testBackupDir, "sample_items.json"), sampleBuffer);

      const manifestPath = path.join(testBackupDir, "backup-manifest.json");
      let manifest = { files: {} };
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      }
      manifest.files = manifest.files || {};
      const checksum = calculateChecksum(sampleBuffer);
      manifest.files["sample_items.json"] = {
        collection: "sample_items",
        documentCount: 1,
        rawSize: sampleBuffer.length,
        storedSize: sampleBuffer.length,
        plainChecksum: checksum,
        storedChecksum: checksum,
        encrypted: false,
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

      const restoreResult = await runMongoRestore({
        backupPath: testBackupDir,
        targetDbName: "klavo_restore_verification_test",
        silent: true,
      });

      assert.ok(restoreResult.success);
      assert.equal(restoreResult.targetDatabase, "klavo_restore_verification_test");
      assert.ok(restoreResult.restoredCollections.includes("sample_items"));
    });
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });
});

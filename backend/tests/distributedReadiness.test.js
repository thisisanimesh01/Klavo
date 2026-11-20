import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "events";
import { RedisCoordinator } from "../src/utils/redisCoordinator.js";
import { RecurringTaskScheduler } from "../src/utils/recurringScheduler.js";
import { rateLimit } from "../src/middleware/rateLimiter.js";
import { validateEnv } from "../src/config/env.js";

describe("REL-10: Distributed Infrastructure Readiness Test Suite", () => {
  describe("Distributed Mode Configuration & Safety Invariants", () => {
    it("fails safely when DISTRIBUTED_MODE is set to 'true' but REDIS_URL is omitted", () => {
      assert.throws(
        () => {
          validateEnv({
            NODE_ENV: "production",
            MONGO_URI: "mongodb+srv://cluster.example.net/klavo",
            JWT_SECRET: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            FRONTEND_URL: "https://app.example.com",
            DISTRIBUTED_MODE: "true",
          });
        },
        /REDIS_URL is required when DISTRIBUTED_MODE is set to 'true'/,
        "Must never silently claim distributed readiness without REDIS_URL"
      );
    });

    it("runs in single-instance mode with graceful fallback when REDIS_URL is absent", () => {
      const config = validateEnv({
        NODE_ENV: "development",
        MONGO_URI: "mongodb://localhost:27017/klavo_dev",
        JWT_SECRET: "0123456789abcdef0123456789abcdef",
      });

      assert.equal(config.DISTRIBUTED_MODE, false);
      assert.equal(config.REDIS_URL, null);
    });
  });

  describe("Redis Coordinator In-Memory Mock Transport", () => {
    // In-process transport stream simulator (zero external TCP port binding)
    const createMockTransport = () => {
      const transport = new EventEmitter();
      const store = new Map();

      transport.write = (chunkStr) => {
        const text = chunkStr.toString("utf8");
        // Parse commands
        if (text.startsWith("*")) {
          const lines = text.split("\r\n");
          const numArgs = Number(lines[0].slice(1));
          const args = [];
          let idx = 1;
          for (let i = 0; i < numArgs; i++) {
            if (idx < lines.length && lines[idx].startsWith("$")) {
              idx++;
              if (idx < lines.length) {
                args.push(lines[idx]);
                idx++;
              }
            }
          }

          const cmd = (args[0] || "").toUpperCase();

          if (cmd === "SET") {
            const key = args[1];
            const val = args[2];
            store.set(key, val);
            process.nextTick(() => transport.emit("data", "+OK\r\n"));
          } else if (cmd === "GET") {
            const key = args[1];
            if (store.has(key)) {
              const val = store.get(key);
              process.nextTick(() => transport.emit("data", `$${val.length}\r\n${val}\r\n`));
            } else {
              process.nextTick(() => transport.emit("data", "$-1\r\n"));
            }
          } else if (cmd === "DEL") {
            const key = args[1];
            const existed = store.delete(key) ? 1 : 0;
            process.nextTick(() => transport.emit("data", `:${existed}\r\n`));
          } else if (cmd === "EVAL") {
            const script = args[1];
            if (script.includes("ZREMRANGEBYSCORE")) {
              // Rate limit response: [allowed (1), remaining (99)]
              process.nextTick(() => transport.emit("data", "*2\r\n:1\r\n:99\r\n"));
            } else {
              // Lock release response: 1
              process.nextTick(() => transport.emit("data", ":1\r\n"));
            }
          } else if (cmd === "PUBLISH") {
            process.nextTick(() => transport.emit("data", ":1\r\n"));
          } else {
            process.nextTick(() => transport.emit("data", "+OK\r\n"));
          }
        }
      };

      transport.destroy = () => {};
      return transport;
    };

    it("executes atomic lock acquisition and release using RESP protocol", async () => {
      const transport = createMockTransport();
      const coordinator = new RedisCoordinator({ transport });

      const connected = await coordinator.connect();
      assert.equal(connected, true);

      const acquired = await coordinator.acquireLock("recurring_job", "pod_1", 10000);
      assert.equal(acquired, true);

      const released = await coordinator.releaseLock("recurring_job", "pod_1");
      assert.equal(released, true);

      await coordinator.close();
    });

    it("evaluates distributed sliding window rate limit query", async () => {
      const transport = createMockTransport();
      const coordinator = new RedisCoordinator({ transport });

      await coordinator.connect();
      const res = await coordinator.checkRateLimit("192.168.1.50", 60000, 100);
      assert.ok(res);
      assert.equal(res.allowed, true);
      assert.equal(res.remaining, 99);

      await coordinator.close();
    });
  });

  describe("Hybrid In-Memory & Distributed Rate Limiter Middleware", () => {
    it("enforces sliding window rate limits and returns 429 when threshold is reached", async () => {
      const limiter = rateLimit({ windowMs: 1000, max: 2 });

      let status = null;
      let body = null;
      let headers = {};

      const req = {
        headers: { "x-forwarded-for": "10.0.0.1" },
        socket: { remoteAddress: "10.0.0.1" },
      };

      const createRes = () => ({
        setHeader: (k, v) => {
          headers[k] = v;
        },
        status: (s) => {
          status = s;
          return {
            json: (b) => {
              body = b;
            },
          };
        },
      });

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      // Request 1: Allowed
      await limiter(req, createRes(), next);
      assert.equal(nextCalled, true);

      // Request 2: Allowed
      nextCalled = false;
      await limiter(req, createRes(), next);
      assert.equal(nextCalled, true);

      // Request 3: Blocked (max 2 per window)
      nextCalled = false;
      await limiter(req, createRes(), next);
      assert.equal(nextCalled, false);
      assert.equal(status, 429);
      assert.ok(body.message);
      assert.ok(headers["Retry-After"] !== undefined);
    });
  });

  describe("Distributed Recurring Task Scheduler", () => {
    it("initializes scheduler and handles tick lifecycle cleanly", () => {
      const scheduler = new RecurringTaskScheduler({
        podId: "pod_unit_test",
        intervalMs: 1000,
      });

      assert.equal(scheduler.running, false);
      scheduler.start();
      assert.equal(scheduler.running, true);
      scheduler.stop();
      assert.equal(scheduler.running, false);
    });
  });
});

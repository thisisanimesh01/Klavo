import test from "node:test";
import assert from "node:assert/strict";
import { errorHandler, notFoundHandler } from "../src/middleware/errorHandler.js";
import { rateLimit } from "../src/middleware/rateLimiter.js";

test("SEC-04: Error Handling Middleware Resilience", async (t) => {
  await t.test("Catches LIMIT_FILE_SIZE and returns clean 400 error", () => {
    let statusCode = null;
    let jsonBody = null;

    const req = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        jsonBody = body;
        return this;
      },
    };
    const next = () => {};

    const multerError = new Error("File too large");
    multerError.code = "LIMIT_FILE_SIZE";

    errorHandler(multerError, req, res, next);

    assert.equal(statusCode, 400);
    assert.equal(jsonBody.message, "File size exceeds the 25MB limit");
  });

  await t.test("Catches CastError and returns clean 400 error without exposing stack", () => {
    let statusCode = null;
    let jsonBody = null;

    const req = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        jsonBody = body;
        return this;
      },
    };
    const next = () => {};

    const castError = new Error("Cast to ObjectId failed");
    castError.name = "CastError";
    castError.path = "projectId";

    errorHandler(castError, req, res, next);

    assert.equal(statusCode, 400);
    assert.equal(jsonBody.message, "Invalid ID format for parameter: projectId");
  });

  await t.test("NotFoundHandler responds with 404 and clean message", () => {
    let statusCode = null;
    let jsonBody = null;

    const req = { method: "POST", originalUrl: "/api/unknown-endpoint" };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        jsonBody = body;
        return this;
      },
    };
    const next = () => {};

    notFoundHandler(req, res, next);

    assert.equal(statusCode, 404);
    assert.equal(jsonBody.message, "Not Found: POST /api/unknown-endpoint");
  });
});

test("SEC-04: In-Memory Sliding Window Rate Limiter", async (t) => {
  await t.test("Allows requests under threshold and blocks on exceeding max limit with 429", () => {
    const limiter = rateLimit({ windowMs: 10000, max: 2, message: "Limit exceeded" });
    const req = { headers: {}, socket: { remoteAddress: "192.168.1.50" } };
    let statusCode = null;
    let jsonBody = null;
    let retryAfterHeader = null;

    const res = {
      setHeader(name, val) {
        if (name === "Retry-After") retryAfterHeader = val;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        jsonBody = body;
        return this;
      },
    };

    let nextCalled = 0;
    const next = () => { nextCalled++; };

    // Request 1: allowed
    limiter(req, res, next);
    assert.equal(nextCalled, 1);

    // Request 2: allowed
    limiter(req, res, next);
    assert.equal(nextCalled, 2);

    // Request 3: blocked (429)
    limiter(req, res, next);
    assert.equal(nextCalled, 2, "Next was not called on rate limit trip");
    assert.equal(statusCode, 429);
    assert.equal(jsonBody.message, "Limit exceeded");
    assert.ok(jsonBody.retryAfterSeconds > 0);
    assert.ok(retryAfterHeader > 0);
  });
});

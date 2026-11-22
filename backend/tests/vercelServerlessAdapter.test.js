import test from "node:test";
import assert from "node:assert/strict";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import handler from "../api/index.js";
import { connectDB } from "../src/config/db.js";

/**
 * Dispatches a simulated HTTP request directly to the Vercel serverless function handler.
 */
const dispatchServerlessRequest = (handlerFn, { method = "GET", url = "/", headers = {}, body = null }) => {
  return new Promise(async (resolve) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    const res = new ServerResponse(req);

    req.method = method.toUpperCase();
    req.url = url;
    req.headers = {};

    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }

    let payloadBuffer = null;
    if (body !== null && body !== undefined) {
      if (typeof body === "object" && !(body instanceof Buffer)) {
        req.headers["content-type"] = req.headers["content-type"] || "application/json";
        payloadBuffer = Buffer.from(JSON.stringify(body));
      } else if (typeof body === "string") {
        payloadBuffer = Buffer.from(body);
      } else if (body instanceof Buffer) {
        payloadBuffer = body;
      }
      req.headers["content-length"] = String(payloadBuffer.length);
    }

    let responseData = "";

    res.write = function (chunk) {
      if (chunk) {
        responseData += Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
      }
      return true;
    };

    res.end = function (chunk) {
      if (chunk) {
        responseData += Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
      }

      let parsedBody = responseData;
      const contentType = res.getHeader("content-type") || "";
      if (typeof contentType === "string" && contentType.includes("application/json")) {
        try {
          parsedBody = JSON.parse(responseData);
        } catch {
          // fallback string
        }
      }

      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody,
      });
    };

    try {
      await handlerFn(req, res);
      if (payloadBuffer) {
        req.push(payloadBuffer);
      }
      req.push(null);
    } catch (handlerErr) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: handlerErr.message }));
      }
    }
  });
};

test("Vercel Serverless Adapter Suite", async (t) => {
  await t.test("MongoDB connection caching reuses cached connection on warm invocations", async () => {
    const mockConnection = {
      connection: {
        host: "mock-cluster.mongodb.net",
        name: "klavo-prod",
        readyState: 1,
      },
    };

    // Pre-populate global serverless cache
    global.mongoose = {
      conn: mockConnection,
      promise: Promise.resolve(mockConnection),
    };

    const cached1 = await connectDB(undefined, { serverless: true, noExit: true });
    assert.strictEqual(cached1, mockConnection, "connectDB should immediately return cached instance");

    const cached2 = await connectDB(undefined, { serverless: true, noExit: true });
    assert.strictEqual(cached2, cached1, "Second invocation must return identical reference without reconnecting");
  });

  await t.test("Serverless handler dispatches Express root probe", async () => {
    global.mongoose = {
      conn: { connection: { host: "mock-cluster.mongodb.net", name: "klavo", readyState: 1 } },
      promise: Promise.resolve({ connection: { host: "mock-cluster.mongodb.net", name: "klavo", readyState: 1 } }),
    };

    const res = await dispatchServerlessRequest(handler, { method: "GET", url: "/" });
    assert.equal(res.status, 200);
    assert.equal(res.body, "Klavo backend running!");
  });

  await t.test("Serverless handler routes API 404 cleanly through Express pipeline", async () => {
    global.mongoose = {
      conn: { connection: { host: "mock-cluster.mongodb.net", name: "klavo", readyState: 1 } },
      promise: Promise.resolve({ connection: { host: "mock-cluster.mongodb.net", name: "klavo", readyState: 1 } }),
    };

    const res = await dispatchServerlessRequest(handler, { method: "GET", url: "/api/unknown-endpoint" });
    assert.equal(res.status, 404);
    assert.ok(res.body);
    assert.ok(typeof res.body.message === "string");
  });

  await t.test("Serverless handler catches DB connection errors safely without crashing process", async () => {
    // Intentionally break cache to test error handling
    global.mongoose = {
      conn: null,
      promise: Promise.reject(new Error("Simulated connection timeout to Atlas")),
    };

    const res = await dispatchServerlessRequest(handler, { method: "GET", url: "/api/health" });
    assert.equal(res.status, 500);
    assert.ok(res.body);
    assert.equal(res.body.message, "Internal Serverless Error");
  });
});

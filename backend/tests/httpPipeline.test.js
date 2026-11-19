import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { dispatchRequest } from "./helpers/testServer.js";

describe("REL-01: HTTP Request/Response Pipeline & Base Routing Integration", () => {
  const app = createApp();

  describe("Server Status & Unmounted Route 404 Handlers", () => {
    it("GET / returns 200 with server alive message", async () => {
      const res = await dispatchRequest(app, { method: "GET", url: "/" });
      assert.equal(res.status, 200);
      assert.equal(res.body, "Klavo backend running!");
    });

    it("returns 404 with structured JSON error for unmounted endpoints", async () => {
      const res = await dispatchRequest(app, { method: "GET", url: "/api/unknown-endpoint-xyz" });
      assert.equal(res.status, 404);
      assert.ok(res.body);
      assert.equal(typeof res.body.message, "string");
      assert.ok(res.body.message.includes("Not Found"));
    });

    it("handles CORS headers properly for preflight requests", async () => {
      const res = await dispatchRequest(app, {
        method: "OPTIONS",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "POST",
        },
      });
      assert.ok(res.status === 204 || res.status === 200);
    });
  });

  describe("Authentication Guard & Middleware Validation", () => {
    it("rejects requests missing the Authorization header with 401", async () => {
      const res = await dispatchRequest(app, { method: "GET", url: "/api/users/me" });
      assert.equal(res.status, 401);
      assert.equal(res.body.message, "No token provided");
    });

    it("rejects invalid Bearer tokens with 401 Unauthorized", async () => {
      const res = await dispatchRequest(app, {
        method: "GET",
        url: "/api/users/me",
        headers: { authorization: "Bearer invalid.malformed.token" },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.message, "Unauthorized");
    });

    it("rejects requests with malformed Authorization header structure", async () => {
      const res = await dispatchRequest(app, {
        method: "GET",
        url: "/api/users/me",
        headers: { authorization: "NotBearerToken" },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.message, "Invalid token format");
    });
  });

  describe("Payload Validation & Error Response Structure", () => {
    it("validates registration field requirements (name, email, password)", async () => {
      const res = await dispatchRequest(app, {
        method: "POST",
        url: "/api/auth/register",
        body: { name: "Incomplete User" },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, "Name, email, and password are required");
    });

    it("validates login field requirements (email, password)", async () => {
      const res = await dispatchRequest(app, {
        method: "POST",
        url: "/api/auth/login",
        body: {},
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, "Email and password are required");
    });

    it("enforces authentication on workspace endpoints", async () => {
      const res = await dispatchRequest(app, {
        method: "POST",
        url: "/api/teams",
        body: { name: "Unauthenticated Team" },
      });
      assert.equal(res.status, 401);
    });

    it("enforces authentication on project endpoints", async () => {
      const res = await dispatchRequest(app, {
        method: "POST",
        url: "/api/projects",
        body: { name: "Unauthenticated Project" },
      });
      assert.equal(res.status, 401);
    });

    it("enforces authentication on task endpoints", async () => {
      const res = await dispatchRequest(app, {
        method: "POST",
        url: "/api/tasks",
        body: { title: "Unauthenticated Task" },
      });
      assert.equal(res.status, 401);
    });

    it("enforces authentication on document endpoints", async () => {
      const res = await dispatchRequest(app, {
        method: "POST",
        url: "/api/documents",
        body: { title: "Unauthenticated Doc" },
      });
      assert.equal(res.status, 401);
    });

    it("enforces authentication on analytics endpoints", async () => {
      const res = await dispatchRequest(app, {
        method: "GET",
        url: "/api/analytics/proj_123/velocity",
      });
      assert.equal(res.status, 401);
    });

    it("enforces authentication on onboarding endpoints", async () => {
      const resGet = await dispatchRequest(app, {
        method: "GET",
        url: "/api/users/onboarding",
      });
      assert.equal(resGet.status, 401);

      const resPut = await dispatchRequest(app, {
        method: "PUT",
        url: "/api/users/onboarding",
        body: { dismissed: true },
      });
      assert.equal(resPut.status, 401);
    });
  });
});

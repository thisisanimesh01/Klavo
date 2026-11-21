import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("FRONTEND INT-01: Integrations & Developer Ecosystem Models", () => {
  it("formats API key display attributes safely with masked prefix", () => {
    const rawKey = "klavo_live_8f7b2c91a03e4d5f6a7b8c9d0e1f2a3b";
    const keyPrefix = `${rawKey.slice(0, 15)}...`;

    assert.equal(keyPrefix, "klavo_live_8f7b...");
    assert.ok(!keyPrefix.includes("0e1f2a3b"));
  });

  it("validates permission scope requirements for actions", () => {
    const userScopes = ["read:tasks", "write:tasks"];
    const checkScope = (required) => userScopes.includes("*") || userScopes.includes(required);

    assert.equal(checkScope("read:tasks"), true);
    assert.equal(checkScope("write:tasks"), true);
    assert.equal(checkScope("read:projects"), false);
  });

  it("validates webhook target URL format and protocols", () => {
    const isValidUrl = (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    };

    assert.equal(isValidUrl("https://api.example.com/webhooks/klavo"), true);
    assert.equal(isValidUrl("http://localhost:3000/events"), true);
    assert.equal(isValidUrl("ftp://invalid.com/path"), false);
    assert.equal(isValidUrl("invalid-url-string"), false);
  });
});

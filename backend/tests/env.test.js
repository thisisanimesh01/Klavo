import test from "node:test";
import assert from "node:assert/strict";
import { validateEnv } from "../src/config/env.js";

test("SEC-02: Backend environment variable validation", async (t) => {
  await t.test("Valid environment variables load successfully", () => {
    process.env.MONGO_URI = "mongodb://localhost:27017/test_klavo";
    process.env.JWT_SECRET = "test_jwt_secret";
    const config = validateEnv();
    assert.equal(config.MONGO_URI, "mongodb://localhost:27017/test_klavo");
    assert.equal(config.JWT_SECRET, "test_jwt_secret");
  });

  await t.test("Missing MONGO_URI throws error without logging secret values", () => {
    delete process.env.MONGO_URI;
    process.env.JWT_SECRET = "super_secret_key_123";

    assert.throws(
      () => validateEnv(),
      (err) => {
        assert.equal(err.message.includes("MONGO_URI"), true);
        assert.equal(err.message.includes("super_secret_key_123"), false);
        return true;
      }
    );
  });

  await t.test("Missing JWT_SECRET throws error without logging secret values", () => {
    process.env.MONGO_URI = "mongodb://localhost:27017/test_klavo";
    delete process.env.JWT_SECRET;

    assert.throws(
      () => validateEnv(),
      (err) => {
        assert.equal(err.message.includes("JWT_SECRET"), true);
        assert.equal(err.message.includes("test_klavo"), false);
        return true;
      }
    );
  });
});

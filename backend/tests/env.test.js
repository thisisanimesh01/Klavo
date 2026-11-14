import assert from "assert";
import { validateEnv } from "../src/config/env.js";

console.log("Running SEC-02 environment configuration test suite...");

// Test 1: Validation succeeds when required variables are present
{
  process.env.MONGO_URI = "mongodb://localhost:27017/test_klavo";
  process.env.JWT_SECRET = "test_jwt_secret";
  const config = validateEnv();
  assert.strictEqual(config.MONGO_URI, "mongodb://localhost:27017/test_klavo");
  assert.strictEqual(config.JWT_SECRET, "test_jwt_secret");
  console.log("✔ Test 1 Passed: Valid environment variables successfully loaded.");
}

// Test 2: Validation fails when MONGO_URI is missing without logging secret values
{
  delete process.env.MONGO_URI;
  process.env.JWT_SECRET = "super_secret_key_123";

  let threw = false;
  try {
    validateEnv();
  } catch (err) {
    threw = true;
    assert.strictEqual(err.message.includes("MONGO_URI"), true);
    // Crucial: Secret must never be in error message
    assert.strictEqual(err.message.includes("super_secret_key_123"), false);
  }
  assert.strictEqual(threw, true, "Expected validateEnv() to throw when MONGO_URI is missing");
  console.log("✔ Test 2 Passed: Missing MONGO_URI caught safely without exposing secrets.");
}

// Test 3: Validation fails when JWT_SECRET is missing without logging secret values
{
  process.env.MONGO_URI = "mongodb://localhost:27017/test_klavo";
  delete process.env.JWT_SECRET;

  let threw = false;
  try {
    validateEnv();
  } catch (err) {
    threw = true;
    assert.strictEqual(err.message.includes("JWT_SECRET"), true);
    assert.strictEqual(err.message.includes("test_klavo"), false);
  }
  assert.strictEqual(threw, true, "Expected validateEnv() to throw when JWT_SECRET is missing");
  console.log("✔ Test 3 Passed: Missing JWT_SECRET caught safely without exposing secrets.");
}

// Test 4: Verify frontend .env does not contain database credentials or secrets
{
  import("fs").then((fs) => {
    import("path").then((path) => {
      import("url").then(({ fileURLToPath }) => {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const frontendEnvPath = path.resolve(__dirname, "../../frontend/.env");
        if (fs.existsSync(frontendEnvPath)) {
          const content = fs.readFileSync(frontendEnvPath, "utf-8");
          assert.strictEqual(content.includes("MONGO_URI"), false, "frontend/.env must NOT contain MONGO_URI");
          assert.strictEqual(content.includes("JWT_SECRET"), false, "frontend/.env must NOT contain JWT_SECRET");
          assert.strictEqual(content.includes("mongodb+srv"), false, "frontend/.env must NOT contain mongodb connection strings");
          console.log("✔ Test 4 Passed: frontend/.env has zero database credentials or secrets.");
        }
      });
    });
  });
}

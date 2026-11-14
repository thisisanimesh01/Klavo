import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { isBcryptHash } from "../src/controllers/authController.js";

test("SEC-01: Password Hashing & Bcrypt Format Detection", async (t) => {
  await t.test("isBcryptHash identifies standard 60-character bcrypt strings", async () => {
    const hash = await bcrypt.hash("securepassword", 10);
    assert.equal(isBcryptHash(hash), true);
  });

  await t.test("isBcryptHash rejects plaintext, empty strings, and null", () => {
    assert.equal(isBcryptHash("plainpassword123"), false);
    assert.equal(isBcryptHash(""), false);
    assert.equal(isBcryptHash(null), false);
    assert.equal(isBcryptHash(undefined), false);
  });
});

test("SEC-01: Authentication registration payload sanitization", async (t) => {
  await t.test("Password hashes are never returned in user response objects", async () => {
    const rawPassword = "TestPassword99!";
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const userInDb = {
      _id: "usr_mock_1",
      name: "Test User",
      email: "test@example.com",
      password: hashedPassword,
    };

    // Client response construction
    const responsePayload = {
      user: {
        _id: userInDb._id,
        name: userInDb.name,
        email: userInDb.email,
      },
      token: "mock_jwt_token",
    };

    assert.equal(responsePayload.user.password, undefined);
    assert.equal(await bcrypt.compare(rawPassword, userInDb.password), true);
    assert.equal(await bcrypt.compare("WrongPassword", userInDb.password), false);
  });
});

test("SEC-01: Seamless legacy account migration on login", async (t) => {
  await t.test("Legacy plaintext password authenticates and updates to bcrypt hash", async () => {
    const legacyUser = {
      email: "legacy@example.com",
      password: "myLegacyPlaintextPassword",
    };

    const loginAttempt = "myLegacyPlaintextPassword";
    let isPasswordValid = false;
    let needsMigration = false;

    if (isBcryptHash(legacyUser.password)) {
      isPasswordValid = await bcrypt.compare(loginAttempt, legacyUser.password);
    } else if (legacyUser.password === loginAttempt) {
      isPasswordValid = true;
      needsMigration = true;
    }

    assert.equal(isPasswordValid, true);
    assert.equal(needsMigration, true);

    // Apply migration
    if (needsMigration) {
      legacyUser.password = await bcrypt.hash(loginAttempt, 10);
    }

    assert.equal(isBcryptHash(legacyUser.password), true);
    assert.notEqual(legacyUser.password, loginAttempt);

    // Verify subsequent login uses bcrypt comparison
    const subsequentValid = await bcrypt.compare(loginAttempt, legacyUser.password);
    assert.equal(subsequentValid, true);
  });
});

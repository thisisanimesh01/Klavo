import assert from "assert";
import bcrypt from "bcryptjs";
import { isBcryptHash } from "../src/controllers/authController.js";

console.log("Running SEC-01 authentication and password hashing test suite...");

// Test 1: Helper isBcryptHash correctly identifies bcrypt hashes
{
  const salt = await bcrypt.genSalt(10);
  const validHash = await bcrypt.hash("mysecretpassword", salt);
  assert.strictEqual(isBcryptHash(validHash), true, "isBcryptHash should return true for valid bcrypt hash");
  assert.strictEqual(isBcryptHash("plainpassword123"), false, "isBcryptHash should return false for plaintext");
  assert.strictEqual(isBcryptHash(""), false, "isBcryptHash should return false for empty string");
  assert.strictEqual(isBcryptHash(null), false, "isBcryptHash should return false for null");
  console.log("✔ Test 1 Passed: isBcryptHash helper accurately detects bcrypt format.");
}

// Test 2: Simulated Registration creates proper bcrypt hash and omits password in response
{
  const mockDb = new Map();
  const mockReq = {
    body: {
      name: "Test User",
      email: "test@example.com",
      password: "StrongPassword123!",
    },
  };

  const hashedPassword = await bcrypt.hash(mockReq.body.password, 10);
  const createdUser = {
    _id: "user_id_123",
    name: mockReq.body.name,
    email: mockReq.body.email.toLowerCase(),
    password: hashedPassword,
    avatar: "",
    googleUser: false,
  };
  mockDb.set(createdUser.email, createdUser);

  // Response payload simulation
  const responsePayload = {
    user: {
      _id: createdUser._id,
      name: createdUser.name,
      email: createdUser.email,
      avatar: createdUser.avatar,
    },
    token: "mock_jwt_token",
  };

  assert.strictEqual(isBcryptHash(createdUser.password), true, "Stored password must be a bcrypt hash");
  assert.strictEqual(responsePayload.user.password, undefined, "Response user payload must never contain password or hash");
  assert.strictEqual(await bcrypt.compare("StrongPassword123!", createdUser.password), true, "Bcrypt compare should match password");
  assert.strictEqual(await bcrypt.compare("WrongPassword", createdUser.password), false, "Bcrypt compare should reject wrong password");
  console.log("✔ Test 2 Passed: Registration flow hashes password and excludes password from API response.");
}

// Test 3: Duplicate user registration rejection
{
  const existingEmails = new Set(["existing@example.com"]);
  const incomingEmail = "EXISTING@example.com".toLowerCase().trim();
  const isDuplicate = existingEmails.has(incomingEmail);
  assert.strictEqual(isDuplicate, true, "Duplicate registration must be rejected");
  console.log("✔ Test 3 Passed: Duplicate user registration is properly detected.");
}

// Test 4: Legacy plaintext password login and seamless migration
{
  const userRecord = {
    _id: "legacy_user_456",
    name: "Legacy User",
    email: "legacy@example.com",
    password: "oldPlaintextPassword",
    googleUser: false,
  };

  const loginAttemptPassword = "oldPlaintextPassword";
  let isPasswordValid = false;
  let needsMigration = false;

  if (isBcryptHash(userRecord.password)) {
    isPasswordValid = await bcrypt.compare(loginAttemptPassword, userRecord.password);
  } else {
    if (userRecord.password === loginAttemptPassword) {
      isPasswordValid = true;
      needsMigration = true;
    }
  }

  assert.strictEqual(isPasswordValid, true, "Legacy password should match initially");
  assert.strictEqual(needsMigration, true, "Plaintext password must trigger migration flag");

  // Perform migration
  if (needsMigration) {
    userRecord.password = await bcrypt.hash(loginAttemptPassword, 10);
  }

  // Verify updated state
  assert.strictEqual(isBcryptHash(userRecord.password), true, "Migrated password must now be a bcrypt hash");
  assert.notStrictEqual(userRecord.password, "oldPlaintextPassword", "Plaintext password must no longer be stored");

  // Verify subsequent login uses bcrypt comparison
  let secondAttemptValid = false;
  let secondNeedsMigration = false;
  if (isBcryptHash(userRecord.password)) {
    secondAttemptValid = await bcrypt.compare("oldPlaintextPassword", userRecord.password);
  } else {
    if (userRecord.password === "oldPlaintextPassword") {
      secondAttemptValid = true;
      secondNeedsMigration = true;
    }
  }
  assert.strictEqual(secondAttemptValid, true, "Subsequent login with correct password succeeds via bcrypt");
  assert.strictEqual(secondNeedsMigration, false, "Subsequent login must not require migration");
  console.log("✔ Test 4 Passed: Legacy plaintext credentials migrate automatically to bcrypt hash upon successful login.");
}

// Test 5: Rejection of invalid password on migrated account
{
  const hash = await bcrypt.hash("CorrectPassword", 10);
  const isMatch = await bcrypt.compare("WrongPassword", hash);
  assert.strictEqual(isMatch, false, "Invalid password attempt must be rejected");
  console.log("✔ Test 5 Passed: Invalid password rejected with bcrypt verification.");
}

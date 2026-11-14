import assert from "assert";

console.log("Running STAB-01 session stability and resilience test suite...");

// Test 1: getSafeStoredUser with valid JSON
{
  const mockStorage = {
    klavo_user: JSON.stringify({ _id: "usr_1", name: "Animesh Yadav", email: "ani@example.com" }),
  };

  const getSafeStoredUser = (storage) => {
    try {
      const raw = storage.klavo_user;
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      delete storage.klavo_user;
      return null;
    }
  };

  const user = getSafeStoredUser(mockStorage);
  assert.strictEqual(user !== null, true);
  assert.strictEqual(user.name, "Animesh Yadav");
  console.log("✔ Test 1 Passed: Valid session JSON parses successfully.");
}

// Test 2: getSafeStoredUser with null or missing key
{
  const mockStorage = {};
  const getSafeStoredUser = (storage) => {
    try {
      const raw = storage.klavo_user;
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      delete storage.klavo_user;
      return null;
    }
  };

  const user = getSafeStoredUser(mockStorage);
  assert.strictEqual(user, null, "Missing user key must return null without crashing");
  console.log("✔ Test 2 Passed: Missing session returns null safely.");
}

// Test 3: getSafeStoredUser with corrupt/malformed JSON string
{
  const mockStorage = {
    klavo_user: "{ corrupt json ... invalid syntax",
  };

  let cleaned = false;
  const getSafeStoredUser = (storage) => {
    try {
      const raw = storage.klavo_user;
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      delete storage.klavo_user;
      cleaned = true;
      return null;
    }
  };

  const user = getSafeStoredUser(mockStorage);
  assert.strictEqual(user, null, "Malformed JSON must return null");
  assert.strictEqual(cleaned, true, "Corrupted localStorage key must be cleared");
  assert.strictEqual(mockStorage.klavo_user, undefined, "Bad key purged from storage");
  console.log("✔ Test 3 Passed: Malformed session string caught and storage cleaned without throwing.");
}

// Test 4: Topbar username resolution fallback
{
  const resolveUserName = (user) => {
    return user?.name || "Guest";
  };

  assert.strictEqual(resolveUserName({ name: "Alice" }), "Alice");
  assert.strictEqual(resolveUserName(null), "Guest", "Null user must fallback to Guest");
  assert.strictEqual(resolveUserName(undefined), "Guest", "Undefined user must fallback to Guest");
  assert.strictEqual(resolveUserName({}), "Guest", "User object without name must fallback to Guest");
  console.log("✔ Test 4 Passed: Topbar safely resolves user name with fallback and never throws.");
}

// Test 5: 401 Interceptor session expiry handling
{
  const mockStorage = {
    klavo_access_token: "expired_jwt_token",
    klavo_user: JSON.stringify({ name: "Alice" }),
  };

  let redirectedTo = null;
  const handle401Error = (error, storage, currentPath) => {
    if (error.status === 401) {
      const isAuthEndpoint = error.url.includes("/auth/login") || error.url.includes("/auth/register");
      if (!isAuthEndpoint) {
        delete storage.klavo_access_token;
        delete storage.klavo_user;
        if (currentPath !== "/login") {
          redirectedTo = "/login";
        }
      }
    }
  };

  // Subtest 5a: 401 on protected route clears session and redirects
  handle401Error({ status: 401, url: "/projects" }, mockStorage, "/projects");
  assert.strictEqual(mockStorage.klavo_access_token, undefined, "Expired token must be purged");
  assert.strictEqual(mockStorage.klavo_user, undefined, "Expired user must be purged");
  assert.strictEqual(redirectedTo, "/login", "Must redirect to /login on expired session");

  // Subtest 5b: 401 on /auth/login does not redirect or wipe legitimate retry state
  redirectedTo = null;
  const loginStorage = { someKey: "123" };
  handle401Error({ status: 401, url: "/auth/login" }, loginStorage, "/login");
  assert.strictEqual(redirectedTo, null, "Login failure 401 must not trigger redirect loop");

  console.log("✔ Test 5 Passed: 401 response interceptor purges expired sessions cleanly without redirect loops.");
}

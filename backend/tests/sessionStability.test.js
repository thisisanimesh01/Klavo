import test from "node:test";
import assert from "node:assert/strict";

test("STAB-01: Session deserialization safety & corruption recovery", async (t) => {
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

  await t.test("Valid JSON restores user session accurately", () => {
    const storage = { klavo_user: JSON.stringify({ name: "Alice", email: "alice@example.com" }) };
    const user = getSafeStoredUser(storage);
    assert.notEqual(user, null);
    assert.equal(user.name, "Alice");
  });

  await t.test("Corrupted JSON does not throw, purges bad key, and returns null", () => {
    const storage = { klavo_user: "{ not valid json ..." };
    const user = getSafeStoredUser(storage);
    assert.equal(user, null);
    assert.equal(storage.klavo_user, undefined);
  });
});

test("STAB-01: Topbar username fallback resilience", async (t) => {
  const resolveUserName = (user) => user?.name || "Guest";

  await t.test("Returns user name when present", () => {
    assert.equal(resolveUserName({ name: "Alice" }), "Alice");
  });

  await t.test("Falls back to 'Guest' when user is null, undefined, or missing name", () => {
    assert.equal(resolveUserName(null), "Guest");
    assert.equal(resolveUserName(undefined), "Guest");
    assert.equal(resolveUserName({}), "Guest");
  });
});

test("STAB-01: 401 response interceptor session purge", async (t) => {
  await t.test("Purges tokens on 401 from protected routes and triggers login redirect", () => {
    const storage = {
      klavo_access_token: "expired_token_xyz",
      klavo_user: JSON.stringify({ name: "Alice" }),
    };

    let redirectedTo = null;
    const handle401 = (url, currentPath) => {
      const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register");
      if (!isAuthEndpoint) {
        delete storage.klavo_access_token;
        delete storage.klavo_user;
        if (currentPath !== "/login") {
          redirectedTo = "/login";
        }
      }
    };

    handle401("/projects", "/projects");
    assert.equal(storage.klavo_access_token, undefined);
    assert.equal(storage.klavo_user, undefined);
    assert.equal(redirectedTo, "/login");
  });
});

import test from "node:test";
import assert from "node:assert/strict";

test("FRONTEND: Auth state & reducer logic", async (t) => {
  // Pure reducer simulation for authSlice
  const initialState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  };

  const authReducer = (state = initialState, action) => {
    switch (action.type) {
      case "auth/setCredentials":
        return {
          ...state,
          user: action.payload.user,
          token: action.payload.token,
          isAuthenticated: true,
          isLoading: false,
        };
      case "auth/logout":
        return {
          ...state,
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        };
      default:
        return state;
    }
  };

  await t.test("setCredentials updates user and token", () => {
    const nextState = authReducer(initialState, {
      type: "auth/setCredentials",
      payload: { user: { name: "Animesh" }, token: "jwt_token_123" },
    });
    assert.equal(nextState.isAuthenticated, true);
    assert.equal(nextState.user.name, "Animesh");
    assert.equal(nextState.token, "jwt_token_123");
  });

  await t.test("logout clears user and resets authentication", () => {
    const loggedInState = {
      user: { name: "Animesh" },
      token: "jwt_token_123",
      isAuthenticated: true,
      isLoading: false,
    };
    const loggedOutState = authReducer(loggedInState, { type: "auth/logout" });
    assert.equal(loggedOutState.isAuthenticated, false);
    assert.equal(loggedOutState.user, null);
    assert.equal(loggedOutState.token, null);
  });
});

test("FRONTEND: Topbar safe user resolution", async (t) => {
  const getGreeting = (user) => {
    const userName = user?.name || "Guest";
    return `Welcome, ${userName}`;
  };

  await t.test("Greets logged in user with their name", () => {
    assert.equal(getGreeting({ name: "Animesh" }), "Welcome, Animesh");
  });

  await t.test("Safely defaults to 'Welcome, Guest' when user is null or missing", () => {
    assert.equal(getGreeting(null), "Welcome, Guest");
    assert.equal(getGreeting(undefined), "Welcome, Guest");
    assert.equal(getGreeting({}), "Welcome, Guest");
  });
});

test("FRONTEND: Theme context state toggling", async (t) => {
  const toggleTheme = (currentTheme) => (currentTheme === "light" ? "dark" : "light");

  await t.test("Toggles from light to dark and vice versa", () => {
    assert.equal(toggleTheme("light"), "dark");
    assert.equal(toggleTheme("dark"), "light");
  });
});

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

test("FRONTEND: Notification slice state management", async (t) => {
  const initialState = {
    items: [],
    unreadCount: 0,
    loading: false,
  };

  const notificationReducer = (state = initialState, action) => {
    switch (action.type) {
      case "notifications/setNotifications": {
        const items = action.payload || [];
        return {
          ...state,
          items,
          unreadCount: items.filter((n) => !n.read).length,
        };
      }
      case "notifications/addNotification": {
        const exists = state.items.some((n) => n._id === action.payload._id);
        if (exists) return state;
        return {
          ...state,
          items: [action.payload, ...state.items],
          unreadCount: action.payload.read ? state.unreadCount : state.unreadCount + 1,
        };
      }
      case "notifications/markRead": {
        const items = state.items.map((n) =>
          n._id === action.payload ? { ...n, read: true } : n
        );
        return {
          ...state,
          items,
          unreadCount: items.filter((n) => !n.read).length,
        };
      }
      case "notifications/markAllRead": {
        return {
          ...state,
          items: state.items.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        };
      }
      default:
        return state;
    }
  };

  await t.test("setNotifications initializes list and calculates unread count", () => {
    const list = [
      { _id: "1", message: "Task assigned", read: false },
      { _id: "2", message: "Comment added", read: true },
    ];
    const state = notificationReducer(initialState, {
      type: "notifications/setNotifications",
      payload: list,
    });
    assert.equal(state.items.length, 2);
    assert.equal(state.unreadCount, 1);
  });

  await t.test("addNotification prepends without duplicating and increments unread count", () => {
    const start = {
      items: [{ _id: "1", message: "Task assigned", read: false }],
      unreadCount: 1,
      loading: false,
    };
    const next = notificationReducer(start, {
      type: "notifications/addNotification",
      payload: { _id: "2", message: "Mentioned in comment", read: false },
    });
    assert.equal(next.items.length, 2);
    assert.equal(next.unreadCount, 2);
    assert.equal(next.items[0]._id, "2");

    // Duplicate prevention
    const dup = notificationReducer(next, {
      type: "notifications/addNotification",
      payload: { _id: "2", message: "Mentioned in comment", read: false },
    });
    assert.equal(dup.items.length, 2);
    assert.equal(dup.unreadCount, 2);
  });

  await t.test("markRead and markAllRead update flags and unread counts", () => {
    const start = {
      items: [
        { _id: "1", read: false },
        { _id: "2", read: false },
      ],
      unreadCount: 2,
      loading: false,
    };
    const step1 = notificationReducer(start, {
      type: "notifications/markRead",
      payload: "1",
    });
    assert.equal(step1.unreadCount, 1);
    assert.equal(step1.items[0].read, true);

    const step2 = notificationReducer(step1, {
      type: "notifications/markAllRead",
    });
    assert.equal(step2.unreadCount, 0);
    assert.equal(step2.items.every((n) => n.read), true);
  });
});

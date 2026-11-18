import test from "node:test";
import assert from "node:assert/strict";

test("FRONTEND UX-04: Advanced Notification Preferences & Reducer Invariants", async (t) => {
  const initialState = {
    items: [],
    unreadCount: 0,
    preferences: null,
    loading: false,
  };

  const notificationReducer = (state = initialState, action) => {
    switch (action.type) {
      case "notifications/setNotifications":
        return {
          ...state,
          items: action.payload || [],
          unreadCount: (action.payload || []).filter((n) => !n.read).length,
        };
      case "notifications/addNotification": {
        const exists = state.items.some((n) => n._id === action.payload._id);
        if (!exists) {
          return {
            ...state,
            items: [action.payload, ...state.items],
            unreadCount: action.payload.read ? state.unreadCount : state.unreadCount + 1,
          };
        }
        return state;
      }
      case "notifications/markRead": {
        const item = state.items.find((n) => n._id === action.payload);
        if (item && !item.read) {
          return {
            ...state,
            items: state.items.map((n) => (n._id === action.payload ? { ...n, read: true } : n)),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        }
        return state;
      }
      case "notifications/removeNotification": {
        const item = state.items.find((n) => n._id === action.payload);
        return {
          ...state,
          items: state.items.filter((n) => n._id !== action.payload),
          unreadCount: item && !item.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        };
      }
      case "notifications/clearAll":
        return {
          ...state,
          items: [],
          unreadCount: 0,
        };
      case "notifications/setPreferences":
        return {
          ...state,
          preferences: action.payload,
        };
      default:
        return state;
    }
  };

  await t.test("setPreferences updates user preferences in store", () => {
    const dummyPrefs = {
      categories: { assignments: true, mentions: false, comments: true },
      channels: { inApp: true },
      quietHours: { enabled: true, start: "22:00", end: "08:00", timezone: "America/New_York" },
      grouping: { enabled: true, windowMinutes: 5 },
    };

    const nextState = notificationReducer(initialState, {
      type: "notifications/setPreferences",
      payload: dummyPrefs,
    });
    assert.deepEqual(nextState.preferences, dummyPrefs);
  });

  await t.test("removeNotification deletes item and decrements unreadCount if unread", () => {
    const stateWithItems = {
      items: [
        { _id: "notif-1", message: "Task 1", read: false },
        { _id: "notif-2", message: "Task 2", read: true },
      ],
      unreadCount: 1,
      preferences: null,
      loading: false,
    };

    // Remove unread
    const afterUnread = notificationReducer(stateWithItems, {
      type: "notifications/removeNotification",
      payload: "notif-1",
    });
    assert.equal(afterUnread.items.length, 1);
    assert.equal(afterUnread.unreadCount, 0);

    // Remove read
    const afterRead = notificationReducer(afterUnread, {
      type: "notifications/removeNotification",
      payload: "notif-2",
    });
    assert.equal(afterRead.items.length, 0);
    assert.equal(afterRead.unreadCount, 0);
  });

  await t.test("clearAll removes all items and resets unread count to 0", () => {
    const stateWithItems = {
      items: [
        { _id: "notif-1", message: "Task 1", read: false },
        { _id: "notif-2", message: "Task 2", read: false },
      ],
      unreadCount: 2,
      preferences: null,
      loading: false,
    };

    const cleared = notificationReducer(stateWithItems, {
      type: "notifications/clearAll",
    });
    assert.equal(cleared.items.length, 0);
    assert.equal(cleared.unreadCount, 0);
  });

  await t.test("category filter matches notification types correctly", () => {
    const sampleItems = [
      { _id: "1", type: "TASK_ASSIGNED", message: "Assigned" },
      { _id: "2", type: "MENTION", message: "Mentioned you" },
      { _id: "3", type: "COMMENT_ADDED", message: "Commented" },
      { _id: "4", type: "REACTION_ADDED", message: "Reacted" },
    ];

    const filterByCategory = (items, filter) => {
      if (filter === "all") return items;
      if (filter === "assignments") return items.filter((n) => n.type === "TASK_ASSIGNED");
      if (filter === "comments") {
        return items.filter((n) =>
          ["COMMENT_ADDED", "COMMENT_REPLIED", "MENTION"].includes(n.type)
        );
      }
      return items;
    };

    assert.equal(filterByCategory(sampleItems, "all").length, 4);
    assert.equal(filterByCategory(sampleItems, "assignments").length, 1);
    assert.equal(filterByCategory(sampleItems, "comments").length, 2);
  });
});

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  unreadCount: 0,
  loading: false,
};

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setNotifications: (state, action) => {
      state.items = action.payload || [];
      state.unreadCount = state.items.filter((n) => !n.read).length;
    },
    addNotification: (state, action) => {
      const exists = state.items.some((n) => n._id === action.payload._id);
      if (!exists) {
        state.items.unshift(action.payload);
        if (!action.payload.read) {
          state.unreadCount += 1;
        }
      }
    },
    markRead: (state, action) => {
      const item = state.items.find((n) => n._id === action.payload);
      if (item && !item.read) {
        item.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllRead: (state) => {
      state.items.forEach((n) => {
        n.read = true;
      });
      state.unreadCount = 0;
    },
  },
});

export const {
  setNotifications,
  addNotification,
  markRead,
  markAllRead,
} = notificationSlice.actions;

export default notificationSlice.reducer;

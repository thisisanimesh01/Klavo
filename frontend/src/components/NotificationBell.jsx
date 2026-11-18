import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  setNotifications,
  addNotification,
  setPreferences,
} from "../store/slices/notificationSlice";
import { getNotifications, getNotificationPreferences } from "../api/notificationApi";
import socket from "../socket";
import NotificationPanel from "./NotificationPanel";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth?.user);
  const { unreadCount } = useSelector((state) => state.notifications);

  useEffect(() => {
    if (!user?._id) return;

    // Fetch existing notifications and preferences from REST API
    const loadInitial = async () => {
      try {
        const [data, prefs] = await Promise.all([
          getNotifications(),
          getNotificationPreferences().catch(() => null),
        ]);
        dispatch(setNotifications(data || []));
        if (prefs) {
          dispatch(setPreferences(prefs));
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    };
    loadInitial();

    // Ensure socket connected and joined to private user room
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("joinUser", { userId: user._id });

    // Listen for live targeted notifications
    const handleNewNotification = (notification) => {
      dispatch(addNotification(notification));
    };

    // Listen for preference sync across tabs/sessions
    const handlePreferenceUpdated = (updatedPrefs) => {
      dispatch(setPreferences(updatedPrefs));
    };

    socket.on("notificationCreated", handleNewNotification);
    socket.on("preferenceUpdated", handlePreferenceUpdated);

    return () => {
      socket.emit("leaveUser", { userId: user._id });
      socket.off("notificationCreated", handleNewNotification);
      socket.off("preferenceUpdated", handlePreferenceUpdated);
    };
  }, [user?._id, dispatch]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        style={{ borderColor: "var(--card-border)" }}
        title="Notifications"
      >
        <span className="text-lg leading-none">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow-sm animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

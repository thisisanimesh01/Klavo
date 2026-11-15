import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  setNotifications,
  addNotification,
} from "../store/slices/notificationSlice";
import { getNotifications } from "../api/notificationApi";
import socket from "../socket";
import NotificationPanel from "./NotificationPanel";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth?.user);
  const { unreadCount } = useSelector((state) => state.notifications);

  useEffect(() => {
    if (!user?._id) return;

    // Fetch existing notifications from REST API
    const loadInitial = async () => {
      try {
        const data = await getNotifications();
        dispatch(setNotifications(data || []));
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

    socket.on("notificationCreated", handleNewNotification);

    return () => {
      socket.emit("leaveUser", { userId: user._id });
      socket.off("notificationCreated", handleNewNotification);
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
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center border-2 border-white dark:border-slate-900">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

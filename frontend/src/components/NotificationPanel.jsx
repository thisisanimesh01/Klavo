import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { markRead, markAllRead } from "../store/slices/notificationSlice";
import { markNotificationAsRead, markAllNotificationsAsRead } from "../api/notificationApi";

export default function NotificationPanel({ open, onClose }) {
  const dispatch = useDispatch();
  const { items, unreadCount } = useSelector((state) => state.notifications);

  if (!open) return null;

  const handleMarkAsRead = async (id, alreadyRead) => {
    if (alreadyRead) return;
    try {
      dispatch(markRead(id));
      await markNotificationAsRead(id);
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      dispatch(markAllRead());
      await markAllNotificationsAsRead();
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  return (
    <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-xl shadow-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-bold">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 px-1"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {items.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No notifications yet.
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n._id}
              onClick={() => handleMarkAsRead(n._id, n.read)}
              className={`p-3 text-xs transition cursor-pointer flex gap-2.5 items-start ${
                n.read
                  ? "bg-transparent text-slate-500 dark:text-slate-400"
                  : "bg-indigo-50/50 dark:bg-indigo-950/20 text-slate-900 dark:text-slate-100 font-medium"
              }`}
            >
              <div className="mt-0.5 text-sm">
                {n.type === "TASK_ASSIGNED" && "📋"}
                {n.type === "COMMENT_ADDED" && "💬"}
                {n.type === "MENTION" && "📢"}
                {n.type === "REACTION_ADDED" && "⭐"}
                {!["TASK_ASSIGNED", "COMMENT_ADDED", "MENTION", "REACTION_ADDED"].includes(n.type) && "🔔"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="line-clamp-2 leading-relaxed">{n.message}</p>
                <span className="text-[10px] text-slate-400 block mt-1">
                  {new Date(n.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                  {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-indigo-600 mt-1 shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

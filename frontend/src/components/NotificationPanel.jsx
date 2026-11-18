import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { markRead, markAllRead, removeNotification, clearAll } from "../store/slices/notificationSlice";
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearNotifications,
} from "../api/notificationApi";
import NotificationPreferencesModal from "./NotificationPreferencesModal";

export default function NotificationPanel({ open, onClose }) {
  const dispatch = useDispatch();
  const { items, unreadCount } = useSelector((state) => state.notifications);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      dispatch(removeNotification(id));
      await deleteNotification(id);
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const filteredItems = items.filter((n) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "unread") return !n.read;
    if (categoryFilter === "assignments") return n.type === "TASK_ASSIGNED";
    if (categoryFilter === "comments") return ["COMMENT_ADDED", "COMMENT_REPLIED", "MENTION"].includes(n.type);
    return true;
  });

  return (
    <>
      <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-xl shadow-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
        {/* Header */}
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
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Notification settings"
            >
              ⚙️
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`px-2 py-0.5 rounded-full font-medium transition ${
              categoryFilter === "all"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("unread")}
            className={`px-2 py-0.5 rounded-full font-medium transition ${
              categoryFilter === "unread"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            Unread
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("assignments")}
            className={`px-2 py-0.5 rounded-full font-medium transition ${
              categoryFilter === "assignments"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("comments")}
            className={`px-2 py-0.5 rounded-full font-medium transition ${
              categoryFilter === "comments"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            Mentions
          </button>
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No notifications {categoryFilter !== "all" ? "in this view" : "yet"}.
            </div>
          ) : (
            filteredItems.map((n) => (
              <div
                key={n._id}
                onClick={() => handleMarkAsRead(n._id, n.read)}
                className={`group p-3 text-xs transition cursor-pointer flex gap-2.5 items-start relative ${
                  n.read
                    ? "bg-transparent text-slate-500 dark:text-slate-400"
                    : "bg-indigo-50/50 dark:bg-indigo-950/20 text-slate-900 dark:text-slate-100 font-medium"
                }`}
              >
                <div className="mt-0.5 text-sm shrink-0">
                  {n.type === "TASK_ASSIGNED" && "📋"}
                  {n.type === "COMMENT_ADDED" && "💬"}
                  {n.type === "COMMENT_REPLIED" && "↩️"}
                  {n.type === "MENTION" && "📢"}
                  {n.type === "REACTION_ADDED" && "⭐"}
                  {n.type === "AUTOMATION_TRIGGERED" && "⚡"}
                  {![
                    "TASK_ASSIGNED",
                    "COMMENT_ADDED",
                    "COMMENT_REPLIED",
                    "MENTION",
                    "REACTION_ADDED",
                    "AUTOMATION_TRIGGERED",
                  ].includes(n.type) && "🔔"}
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <p className="line-clamp-2 leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {new Date(n.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, n._id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 text-slate-400 transition p-0.5"
                    title="Dismiss notification"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {prefsOpen && (
        <NotificationPreferencesModal
          isOpen={prefsOpen}
          onClose={() => setPrefsOpen(false)}
        />
      )}
    </>
  );
}

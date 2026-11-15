import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useTheme } from "../context/ThemeContext";
import { logout as logoutAction } from "../store/slices/authSlice";
import axiosClient from "../api/axiosClient";
import NotificationBell from "./NotificationBell";

export default function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth?.user);

  // Safely resolve username with robust fallback
  const userName = user?.name || "Guest";

  const handleLogout = async () => {
    try {
      await axiosClient.post("/auth/logout");
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      dispatch(logoutAction());
      window.location.href = "/login";
    }
  };

  return (
    <div
      className="flex justify-between items-center p-4 rounded-xl shadow"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--card-border)",
      }}
    >
      <h2 className="text-xl font-semibold" style={{ color: "var(--text-main)" }}>
        Welcome, {userName}
      </h2>

      <div className="flex items-center gap-4">
        {/* Real-time Notifications Bell */}
        <NotificationBell />

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="px-4 py-2 rounded-lg border"
          style={{
            background: theme === "light" ? "#FFF" : "#000000",
            borderColor: "var(--card-border)",
            color: theme === "light" ? "#000" : "#FFF",
            fontWeight: 600,
          }}
        >
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 transition text-white rounded-lg font-semibold"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

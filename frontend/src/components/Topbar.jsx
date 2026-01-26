import React from "react";
import { useTheme } from "../context/ThemeContext";
import axiosClient from "../api/axiosClient";

export default function Topbar() {
  const { theme, toggleTheme } = useTheme();

  const logout = () => {
    axiosClient.post("/auth/logout");
    window.location.href = "/login";
  };

  return (
    <div
      className="flex justify-between items-center p-4 rounded-xl shadow"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--card-border)"
      }}
    >
      <h2 className="text-xl font-semibold" style={{ color: "var(--text-main)" }}>
        Welcome, Animesh Yadav
      </h2>

      <div className="flex items-center gap-4">

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="px-4 py-2 rounded-lg border"
          style={{
            background: theme === "light" ? "#FFF" : "#1E1B4B",
            borderColor: "var(--card-border)",
            color: theme === "light" ? "#000" : "#FFF",
            fontWeight: 600
          }}
        >
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>

        <button
          onClick={logout}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

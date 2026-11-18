import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useTheme } from "../context/ThemeContext";
import { logout as logoutAction } from "../store/slices/authSlice";
import axiosClient from "../api/axiosClient";
import NotificationBell from "./NotificationBell";
import { Menu, Moon, Sun, LogOut } from "lucide-react";

export default function Topbar({ onToggleMobileMenu = () => {} }) {
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
    <header
      className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-3.5 border-b sticky top-0 z-30 transition-colors"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--card-border)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle hamburger */}
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 -ml-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>

        <h2 className="text-base sm:text-lg md:text-xl font-semibold truncate" style={{ color: "var(--text-main)" }}>
          Welcome, {userName}
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time Notifications Bell */}
        <NotificationBell />

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 sm:px-3 sm:py-2 rounded-xl border flex items-center gap-1.5 transition text-xs sm:text-sm font-semibold min-h-[40px]"
          style={{
            background: theme === "light" ? "#FFF" : "#0f172a",
            borderColor: "var(--card-border)",
            color: "var(--text-main)",
          }}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light" ? (
            <>
              <Moon size={16} className="text-indigo-600" />
              <span className="hidden sm:inline">Dark</span>
            </>
          ) : (
            <>
              <Sun size={16} className="text-amber-400" />
              <span className="hidden sm:inline">Light</span>
            </>
          )}
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2 sm:px-3.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 transition text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-xs min-h-[40px]"
          title="Log out of Klavo"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

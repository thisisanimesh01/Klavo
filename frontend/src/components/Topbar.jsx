import React from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useTheme } from "../context/ThemeContext";
import { logout as logoutAction } from "../store/slices/authSlice";
import axiosClient from "../api/axiosClient";
import NotificationBell from "./NotificationBell";
import { Avatar } from "./ui";
import { useOnboarding } from "../context/OnboardingContext";
import { Menu, Moon, Sun, LogOut, Search, Settings, HelpCircle } from "lucide-react";

export default function Topbar({
  onToggleMobileMenu = () => {},
  onOpenCommandPalette = () => {},
}) {
  const { theme, toggleTheme } = useTheme();
  const { startTour } = useOnboarding();
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

      {/* Global Command Palette Trigger Button (UX-03) */}
      <div className="flex-1 max-w-md mx-3 sm:mx-6">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 sm:py-2 rounded-xl border text-xs sm:text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition shadow-2xs"
          style={{
            background: "var(--bg-main)",
            borderColor: "var(--card-border)",
          }}
          title="Open Command Palette (Cmd+K or Ctrl+K)"
          aria-label="Open global search and command palette"
        >
          <div className="flex items-center gap-2 truncate">
            <Search size={15} className="text-slate-400 shrink-0" />
            <span className="truncate hidden sm:inline">Search projects, tasks, docs...</span>
            <span className="truncate sm:hidden">Search...</span>
          </div>

          <div className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px] shrink-0 text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700">⌘K</span>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time Notifications Bell */}
        <NotificationBell />

        {/* Product Guidance / Walkthrough Quick Trigger (UX-08) */}
        <button
          onClick={() => startTour(0)}
          className="p-2 sm:px-2.5 sm:py-2 rounded-xl border flex items-center gap-1.5 transition text-xs font-medium min-h-[40px] text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40"
          style={{
            borderColor: "var(--card-border)",
            background: "var(--bg-main)",
          }}
          title="Product Tour & Help Guide"
          aria-label="Launch interactive product guide"
        >
          <HelpCircle size={16} />
          <span className="hidden xl:inline">Guide</span>
        </button>

        {/* User Profile / Settings Quick Link (UX-05) */}
        <Link
          to="/settings"
          className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[40px]"
          style={{
            borderColor: "var(--card-border)",
            color: "var(--text-main)",
          }}
          title="Account & Workspace Settings"
          aria-label="Account and Workspace Settings"
        >
          <Avatar
            src={user?.avatar}
            name={userName}
            size="sm"
            className="shrink-0"
          />
          <span className="hidden lg:inline text-xs font-medium max-w-[100px] truncate">
            {userName}
          </span>
          <Settings size={15} className="text-slate-400 hidden sm:inline" />
        </Link>

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
          aria-label="Log out of Klavo"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  FolderKanban,
  Users,
  Calendar,
  FileUp,
  BarChart2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function Sidebar({ mobileOpen = false, onMobileClose = () => {} }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const menu = [
    { label: "Dashboard", icon: <Home size={20} />, path: "/" },
    { label: "Projects", icon: <FolderKanban size={20} />, path: "/projects" },
    { label: "Teams", icon: <Users size={20} />, path: "/teams" },
    { label: "Calendar", icon: <Calendar size={20} />, path: "/calendar" },
    { label: "Files", icon: <FileUp size={20} />, path: "/files" },
    { label: "Analytics", icon: <BarChart2 size={20} />, path: "/analytics" },
  ];

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto h-screen bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out flex flex-col ${
        /* Mobile drawer styling */
        mobileOpen
          ? "translate-x-0 w-64 shadow-2xl"
          : "-translate-x-full md:translate-x-0"
      } ${
        /* Desktop collapse styling */
        collapsed ? "md:w-16" : "md:w-60"
      }`}
      aria-label="Sidebar navigation"
    >
      {/* Header / Logo */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800/60">
        <div className="font-bold text-xl text-indigo-400 tracking-tight flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-base shadow-xs">
            K
          </span>
          {(!collapsed || mobileOpen) && <span>Klavo</span>}
        </div>

        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          aria-label="Close navigation drawer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Menu links */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {menu.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              to={item.path}
              key={item.path}
              onClick={() => {
                if (onMobileClose) onMobileClose();
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300
                hover:bg-slate-800 hover:text-white transition group min-h-[44px]
                ${isActive ? "bg-indigo-600/20 text-indigo-400 font-semibold border border-indigo-500/30" : ""}
              `}
              title={collapsed && !mobileOpen ? item.label : undefined}
            >
              <span className={`shrink-0 ${isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-white"}`}>
                {item.icon}
              </span>
              {(!collapsed || mobileOpen) && <span className="truncate text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Desktop Collapse Button */}
      <div className="hidden md:block p-3 border-t border-slate-800/60">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold transition"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <>
              <ChevronLeft size={18} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

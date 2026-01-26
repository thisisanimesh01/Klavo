import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  FolderKanban,
  Users,
  Calendar,
  FileUp,
  BarChart2,
} from "lucide-react";

export default function Sidebar() {
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
    <div
      className={`h-screen bg-slate-900 border-r border-slate-800 transition-all
      ${collapsed ? "w-16" : "w-60"} flex flex-col`}
    >
      {/* Logo */}
      <div className="p-4 font-bold text-xl text-indigo-400">
        {collapsed ? "K" : "Klavo"}
      </div>

      {/* Menu */}
      <nav className="flex-1 px-2 space-y-1">
        {menu.map((item) => (
          <Link
            to={item.path}
            key={item.path}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300
              hover:bg-slate-800 hover:text-white transition
              ${location.pathname === item.path ? "bg-slate-800 text-white" : ""}
            `}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 text-slate-400 hover:text-white hover:bg-slate-800"
      >
        {collapsed ? "➡️ Expand" : "⬅️ Collapse"}
      </button>
    </div>
  );
}

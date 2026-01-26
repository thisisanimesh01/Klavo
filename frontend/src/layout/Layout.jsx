import React from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function Layout({ children }) {
  const location = useLocation();

  // Routes where sidebar should NOT appear
  const hideSidebarRoutes = [
    "/teams",
    "/projects",
    "/calendar",
    "/files"
  ];

  // Also hide sidebar on dynamic kanban routes like /kanban/123
  const hideSidebar =
    hideSidebarRoutes.includes(location.pathname) ||
    location.pathname.startsWith("/kanban/");

  return (
    <div className="flex min-h-screen"
      style={{ background: "var(--bg-main)", color: "var(--text-main)" }}
    >
      {/* Show sidebar ONLY when allowed */}
      {!hideSidebar && <Sidebar />}

      <div className="flex-1">
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

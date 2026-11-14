import React from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function Layout({ children }) {
  return (
    <div
      className="flex min-h-screen"
      style={{ background: "var(--bg-main)", color: "var(--text-main)" }}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="p-6 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

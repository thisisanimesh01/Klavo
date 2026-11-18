import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="flex min-h-screen relative"
      style={{ background: "var(--bg-main)", color: "var(--text-main)" }}
    >
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Responsive drawer on mobile, static on md+ */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        <Topbar onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} />
        <main className="p-3 sm:p-5 md:p-6 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

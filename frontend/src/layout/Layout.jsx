import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import CommandPalette from "../components/CommandPalette";

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global keyboard shortcut listener for Cmd+K (Mac) and Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="flex min-h-screen relative"
      style={{ background: "var(--bg-main)", color: "var(--text-main)" }}
    >
      {/* Skip to Content Link for Keyboard and Screen Reader Navigation */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

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
        <Topbar
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
        <main id="main-content" tabIndex={-1} className="p-3 sm:p-5 md:p-6 flex-1 overflow-auto outline-hidden">
          {children}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}

import React, { createContext, useContext, useState, useCallback } from "react";

const LiveRegionContext = createContext({
  announce: () => {},
});

/**
 * Provides an accessible screen-reader live region (`aria-live="polite"`)
 * across the application to announce loading, save success, errors, and background updates.
 */
export function LiveRegionProvider({ children }) {
  const [announcement, setAnnouncement] = useState("");

  const announce = useCallback((message, politeness = "polite") => {
    if (!message) return;
    setAnnouncement(message);
    // Auto-clear after screen readers capture it
    const timer = setTimeout(() => {
      setAnnouncement("");
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LiveRegionContext.Provider value={{ announce }}>
      {children}
      {/* Visually hidden but accessible live region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only fixed -top-9999 -left-9999 w-px h-px overflow-hidden"
      >
        {announcement}
      </div>
    </LiveRegionContext.Provider>
  );
}

export function useLiveAnnouncement() {
  return useContext(LiveRegionContext);
}

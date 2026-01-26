import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("klavo_theme") || "light"
  );

  useEffect(() => {
    localStorage.setItem("klavo_theme", theme);

    const root = document.documentElement;

    // Apply Tailwind dark mode class
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Apply custom color variables
    if (theme === "light") {
      root.style.setProperty("--bg-main", "#F3EEFF");       // Lavender
      root.style.setProperty("--bg-card", "#FFFFFF");
      root.style.setProperty("--text-main", "#1B1440");     // Deep purple
      root.style.setProperty("--text-muted", "#4B3E7A");
      root.style.setProperty("--card-border", "rgba(150,120,255,0.25)");
    } else {
      root.style.setProperty("--bg-main", "#0F0625");        // Deep Purple Night
      root.style.setProperty("--bg-card", "#1B1537");
      root.style.setProperty("--text-main", "#FFFFFF");
      root.style.setProperty("--text-muted", "#C6B6FF");
      root.style.setProperty("--card-border", "rgba(255,255,255,0.12)");
    }
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div
        style={{
          backgroundColor: "var(--bg-main)",
          color: "var(--text-main)",
          minHeight: "100vh",
          transition: "background 0.3s ease, color 0.3s ease",
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

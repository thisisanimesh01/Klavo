import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("klavo_theme") || "light"
  );

  // Density preference: "comfortable" | "compact"
  const [density, setDensity] = useState(
    () => localStorage.getItem("klavo_density") || "comfortable"
  );

  useEffect(() => {
    localStorage.setItem("klavo_theme", theme);
    localStorage.setItem("klavo_density", density);

    const root = document.documentElement;

    // Apply Tailwind dark mode class
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Apply Density class
    if (density === "compact") {
      root.classList.add("density-compact");
      root.classList.remove("density-comfortable");
      root.style.setProperty("--spacing-unit", "0.75rem");
      root.style.setProperty("--card-padding", "1rem");
    } else {
      root.classList.add("density-comfortable");
      root.classList.remove("density-compact");
      root.style.setProperty("--spacing-unit", "1.25rem");
      root.style.setProperty("--card-padding", "1.5rem");
    }

    // Apply custom color variables verified for WCAG 2.2 AA contrast standards (>= 4.5:1 for body, >= 3:1 for large text)
    if (theme === "light") {
      root.style.setProperty("--bg-main", "#F8FAFC");       // Soft light slate
      root.style.setProperty("--bg-card", "#FFFFFF");
      root.style.setProperty("--text-main", "#0F172A");     // Deep slate (Contrast ratio ~16:1 against #FFF)
      root.style.setProperty("--text-muted", "#475569");    // Slate-600 (Contrast ratio ~6.9:1 against #FFF)
      root.style.setProperty("--card-border", "rgba(203, 213, 225, 0.8)");
      root.style.setProperty("--color-primary", "#4F46E5"); // Indigo-600
    } else {
      root.style.setProperty("--bg-main", "#020617");        // Slate-950
      root.style.setProperty("--bg-card", "#0F172A");        // Slate-900
      root.style.setProperty("--text-main", "#F8FAFC");      // Slate-50 (Contrast ratio ~18:1 against #0F172A)
      root.style.setProperty("--text-muted", "#94A3B8");     // Slate-400 (Contrast ratio ~5.8:1 against #0F172A)
      root.style.setProperty("--card-border", "rgba(51, 65, 85, 0.8)");
      root.style.setProperty("--color-primary", "#6366F1");  // Indigo-500
    }
  }, [theme, density]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  const toggleDensity = () =>
    setDensity((prev) => (prev === "comfortable" ? "compact" : "comfortable"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, density, setDensity, toggleDensity }}>
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

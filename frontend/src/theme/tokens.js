/**
 * Klavo Design System Tokens (UX-01)
 *
 * Centralized, standardized design token definitions for:
 * - Colors (brand, semantic, neutrals)
 * - Typography (font families, scales, weights)
 * - Spacing & Sizing
 * - Radii (border radius)
 * - Shadows & Elevations
 * - Borders & Outlines
 * - Transitions & Motion
 */

export const colors = {
  brand: {
    50: "#EEF2FF",
    100: "#E0E7FF",
    200: "#C7D2FE",
    300: "#A5B4FC",
    400: "#818CF8",
    500: "#6366F1", // Primary brand Indigo
    600: "#4F46E5",
    700: "#4338CA",
    800: "#3730A3",
    900: "#312E81",
  },
  semantic: {
    success: {
      light: "#10B981", // Emerald 500
      dark: "#059669",
      bgLight: "#ECFDF5",
      bgDark: "rgba(16, 185, 129, 0.15)",
      borderLight: "#A7F3D0",
      borderDark: "rgba(16, 185, 129, 0.3)",
      textLight: "#065F46",
      textDark: "#34D399",
    },
    warning: {
      light: "#F59E0B", // Amber 500
      dark: "#D97706",
      bgLight: "#FFFBEB",
      bgDark: "rgba(245, 158, 11, 0.15)",
      borderLight: "#FDE68A",
      borderDark: "rgba(245, 158, 11, 0.3)",
      textLight: "#92400E",
      textDark: "#FBBF24",
    },
    danger: {
      light: "#EF4444", // Red 500
      dark: "#DC2626",
      bgLight: "#FEF2F2",
      bgDark: "rgba(239, 68, 68, 0.15)",
      borderLight: "#FECACA",
      borderDark: "rgba(239, 68, 68, 0.3)",
      textLight: "#991B1B",
      textDark: "#F87171",
    },
    info: {
      light: "#0EA5E9", // Sky 500
      dark: "#0284C7",
      bgLight: "#F0F9FF",
      bgDark: "rgba(14, 165, 233, 0.15)",
      borderLight: "#BAE6FD",
      borderDark: "rgba(14, 165, 233, 0.3)",
      textLight: "#075985",
      textDark: "#38BDF8",
    },
  },
  neutrals: {
    slate: {
      50: "#F8FAFC",
      100: "#F1F5F9",
      200: "#E2E8F0",
      300: "#CBD5E1",
      400: "#94A3B8",
      500: "#64748B",
      600: "#475569",
      700: "#334155",
      800: "#1E293B",
      900: "#0F172A",
      950: "#020617",
    },
  },
};

export const typography = {
  fonts: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  sizes: {
    xs: ["0.75rem", { lineHeight: "1rem" }],
    sm: ["0.875rem", { lineHeight: "1.25rem" }],
    base: ["1rem", { lineHeight: "1.5rem" }],
    lg: ["1.125rem", { lineHeight: "1.75rem" }],
    xl: ["1.25rem", { lineHeight: "1.75rem" }],
    "2xl": ["1.5rem", { lineHeight: "2rem" }],
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
  },
};

export const radii = {
  none: "0px",
  sm: "0.25rem", // 4px
  md: "0.375rem", // 6px
  lg: "0.5rem", // 8px
  xl: "0.75rem", // 12px
  "2xl": "1rem", // 16px
  full: "9999px",
};

export const shadows = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  glow: "0 0 15px rgba(99, 102, 241, 0.35)",
};

export const transitions = {
  default: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
  fast: "all 0.1s ease-in-out",
  smooth: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
};

export const breakpoints = {
  xs: "360px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
};

const designTokens = {
  colors,
  typography,
  radii,
  shadows,
  transitions,
  breakpoints,
};

export default designTokens;

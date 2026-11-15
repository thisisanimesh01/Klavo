import React from "react";

export const PRIORITY_STYLES = {
  low: {
    bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    dot: "bg-slate-400",
  },
  medium: {
    bg: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
    dot: "bg-blue-500",
  },
  high: {
    bg: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    dot: "bg-amber-500",
  },
  critical: {
    bg: "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
    dot: "bg-red-500",
  },
  urgent: {
    bg: "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900 animate-pulse",
    dot: "bg-purple-600",
  },
};

export default function PriorityBadge({ priority = "medium", showDot = true, className = "" }) {
  const normPriority = (priority || "medium").toLowerCase();
  const config = PRIORITY_STYLES[normPriority] || PRIORITY_STYLES.medium;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider ${config.bg} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
      {normPriority}
    </span>
  );
}

import React from "react";

/**
 * Klavo Badge Component (UX-01)
 *
 * Semantic color badges for status, priorities, tags, categories:
 * - Variants: 'primary', 'success', 'warning', 'danger', 'info', 'neutral'
 * - Sizes: 'xs', 'sm', 'md'
 * - Optional dot indicator
 */
export const Badge = ({
  children,
  variant = "neutral",
  size = "sm",
  dot = false,
  className = "",
  ...props
}) => {
  const variantStyles = {
    primary: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    danger: "bg-red-500/10 text-red-400 border-red-500/30",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    neutral: "bg-slate-800 text-slate-300 border-slate-700/60",
  };

  const dotColors = {
    primary: "bg-indigo-400",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-red-400",
    info: "bg-sky-400",
    neutral: "bg-slate-400",
  };

  const sizeStyles = {
    xs: "px-1.5 py-0.5 text-[10px] gap-1",
    sm: "px-2.5 py-0.5 text-xs gap-1.5",
    md: "px-3 py-1 text-xs gap-2",
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantStyles[variant] || variantStyles.neutral} ${
        sizeStyles[size] || sizeStyles.sm
      } ${className}`.trim()}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant] || dotColors.neutral}`}
        />
      )}
      <span>{children}</span>
    </span>
  );
};

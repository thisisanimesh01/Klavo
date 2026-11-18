import React from "react";

/**
 * Klavo Card Component (UX-01)
 *
 * Consistent container surface with border, shadow, and rounded radii.
 */
export const Card = ({
  children,
  className = "",
  hoverable = false,
  padding = "md",
  ...props
}) => {
  const paddingMap = {
    none: "p-0",
    sm: "p-3",
    md: "p-5",
    lg: "p-7",
  };

  return (
    <div
      className={`bg-slate-900/60 border border-slate-800 rounded-2xl shadow-sm text-left transition duration-150 ${
        hoverable ? "hover:border-slate-700 hover:shadow-md hover:bg-slate-900/80 cursor-pointer" : ""
      } ${paddingMap[padding] || paddingMap.md} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, title, subtitle, action, className = "" }) => {
  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className}`.trim()}>
      {title ? (
        <div>
          <h3 className="font-semibold text-slate-100 text-base">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      ) : (
        children
      )}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

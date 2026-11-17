import React from "react";
import { Inbox, Loader2 } from "lucide-react";

/**
 * Klavo Empty State Component (UX-01)
 */
export const EmptyState = ({
  icon: Icon = Inbox,
  title = "No Data Found",
  description = "There are no records to display at this time.",
  action,
  className = "",
}) => {
  return (
    <div
      className={`p-10 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60 flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-slate-400 shadow-sm">
        <Icon size={24} />
      </div>
      <div>
        <h3 className="font-semibold text-slate-200 text-sm">{title}</h3>
        {description && (
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{description}</p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};

/**
 * Klavo Loading State Component (UX-01)
 */
export const LoadingState = ({
  message = "Loading...",
  size = "md",
  className = "",
}) => {
  const sizeMap = {
    sm: 18,
    md: 26,
    lg: 36,
  };

  return (
    <div
      className={`p-10 text-center flex flex-col items-center justify-center space-y-2.5 text-slate-400 ${className}`}
    >
      <Loader2 className="animate-spin text-indigo-500" size={sizeMap[size] || 26} />
      {message && <span className="text-xs font-medium">{message}</span>}
    </div>
  );
};

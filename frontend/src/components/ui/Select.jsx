import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Klavo Select Component (UX-01)
 *
 * Standardized select dropdown supporting:
 * - Label & helperText / error
 * - Custom ChevronDown icon
 * - Standardized focus ring and hover styles
 */
export const Select = forwardRef(
  (
    {
      label,
      error,
      helperText,
      options = [],
      children,
      className = "",
      id,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-slate-300">
            {label}
          </label>
        )}

        <div className="relative rounded-xl shadow-sm">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`w-full appearance-none rounded-xl border bg-slate-900 text-slate-100 text-sm py-2 pl-3.5 pr-9 transition duration-150 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
              error
                ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/30 text-red-100"
                : "border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30"
            } ${className}`}
            {...props}
          >
            {children ||
              options.map((opt) => (
                <option key={opt.value ?? opt.id} value={opt.value ?? opt.id} className="bg-slate-900 text-slate-200">
                  {opt.label ?? opt.name}
                </option>
              ))}
          </select>

          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            <ChevronDown size={15} />
          </div>
        </div>

        {error ? (
          <p className="text-xs text-red-400 mt-1">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-400 mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";

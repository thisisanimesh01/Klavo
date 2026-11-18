import React, { forwardRef } from "react";

/**
 * Klavo Input Component (UX-01)
 *
 * Standardized input field supporting:
 * - Label & helperText
 * - Error message with invalid ring/border state
 * - Left & Right adornments/icons
 * - Focus ring & disabled styles
 */
export const Input = forwardRef(
  (
    {
      label,
      error,
      helperText,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      className = "",
      id,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-300">
            {label}
          </label>
        )}

        <div className="relative rounded-xl shadow-sm">
          {LeftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {React.isValidElement(LeftIcon) ? LeftIcon : <LeftIcon size={16} />}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full rounded-xl border bg-slate-900 text-slate-100 placeholder-slate-500 text-sm py-2 transition duration-150 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              LeftIcon ? "pl-9" : "pl-3.5"
            } ${RightIcon ? "pr-9" : "pr-3.5"} ${
              error
                ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/30 text-red-100"
                : "border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30"
            } ${className}`}
            {...props}
          />

          {RightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              {React.isValidElement(RightIcon) ? RightIcon : <RightIcon size={16} />}
            </div>
          )}
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

Input.displayName = "Input";

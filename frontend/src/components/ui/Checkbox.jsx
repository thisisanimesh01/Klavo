import React, { forwardRef } from "react";
import { Check } from "lucide-react";

/**
 * Klavo Checkbox Component (UX-01)
 *
 * Standardized checkbox with accessible focus ring and custom checkmark.
 */
export const Checkbox = forwardRef(
  ({ label, description, id, checked = false, disabled = false, onChange, className = "", ...props }, ref) => {
    const checkboxId = id || (label ? `cb-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    return (
      <div className={`flex items-start gap-2.5 ${className}`}>
        <div className="relative flex items-center h-5">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="peer sr-only"
            {...props}
          />
          <div
            onClick={(e) => {
              if (disabled || !onChange) return;
              onChange({ target: { checked: !checked } });
            }}
            className={`w-4 h-4 rounded-md border flex items-center justify-center transition duration-150 cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 ${
              checked
                ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                : "bg-slate-900 border-slate-700 hover:border-slate-500 text-transparent"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Check size={11} strokeWidth={3} className={checked ? "block" : "hidden"} />
          </div>
        </div>

        {(label || description) && (
          <div className="text-left select-none cursor-pointer" onClick={() => !disabled && onChange && onChange({ target: { checked: !checked } })}>
            {label && <label htmlFor={checkboxId} className="text-xs font-semibold text-slate-200 block">{label}</label>}
            {description && <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

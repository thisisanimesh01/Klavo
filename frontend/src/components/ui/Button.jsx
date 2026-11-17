import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

/**
 * Klavo Button Component (UX-01)
 *
 * Standardized button primitive supporting:
 * - Variants: 'primary', 'secondary', 'danger', 'ghost', 'outline', 'success'
 * - Sizes: 'xs', 'sm', 'md', 'lg'
 * - Loading state with spinner
 * - Focus-visible ring, disabled, hover, and active states
 */
export const Button = forwardRef(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      className = "",
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center font-medium rounded-xl transition duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variantClasses = {
      primary:
        "bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 focus-visible:ring-indigo-500 shadow-sm",
      secondary:
        "bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/60 focus-visible:ring-slate-500",
      outline:
        "bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:ring-indigo-500",
      danger:
        "bg-red-600 text-white hover:bg-red-500 active:bg-red-700 focus-visible:ring-red-500 shadow-sm",
      success:
        "bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-emerald-500 shadow-sm",
      ghost:
        "bg-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 focus-visible:ring-slate-500",
    };

    const sizeClasses = {
      xs: "px-2.5 py-1 text-xs gap-1.5",
      sm: "px-3 py-1.5 text-xs gap-1.5",
      md: "px-4 py-2 text-sm gap-2",
      lg: "px-5 py-2.5 text-base gap-2.5",
    };

    const combinedClasses = `${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${
      sizeClasses[size] || sizeClasses.md
    } ${className}`.trim();

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={combinedClasses}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="animate-spin shrink-0" size={size === "xs" ? 12 : size === "sm" ? 14 : 16} />
        ) : LeftIcon ? (
          <span className="shrink-0">{React.isValidElement(LeftIcon) ? LeftIcon : <LeftIcon size={size === "xs" ? 12 : size === "sm" ? 14 : 16} />}</span>
        ) : null}

        <span>{children}</span>

        {!isLoading && RightIcon ? (
          <span className="shrink-0">{React.isValidElement(RightIcon) ? RightIcon : <RightIcon size={size === "xs" ? 12 : size === "sm" ? 14 : 16} />}</span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = "Button";

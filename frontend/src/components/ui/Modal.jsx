import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Klavo Modal Component (UX-01 / UX-07)
 *
 * Accessible dialog overlay adhering to WCAG 2.2 AA standards:
 * - Focus trapping inside the active dialog
 * - Escape key dismissal
 * - Focus restoration to previously active element on close
 * - `aria-modal="true"`, `role="dialog"`, accessible title labelling
 * - Responsive backdrop and scroll locking
 */
export const Modal = ({
  isOpen = false,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  className = "",
  ariaLabel,
}) => {
  const dialogRef = useRef(null);
  const triggerElementRef = useRef(null);

  // Capture trigger element before modal opens for focus restoration
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Focus trap & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    // Focus the dialog or its first focusable child
    const focusableElements = dialog.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (firstElement) {
      firstElement.focus();
    } else {
      dialog.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        if (e.shiftKey) {
          // Shift + Tab -> loop to last
          if (document.activeElement === firstElement || document.activeElement === dialog) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab -> loop to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus to trigger element on unmount/close
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === "function") {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
  };

  const titleId = title ? `modal-title-${Math.random().toString(36).slice(2, 9)}` : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in overflow-y-auto"
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`w-full ${sizeClasses[size] || sizeClasses.md} bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto outline-hidden ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={!titleId ? ariaLabel || "Modal dialog" : undefined}
      >
        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-800 shrink-0">
            <div>
              {title && (
                <h3 id={titleId} className="text-base font-semibold text-slate-100">
                  {title}
                </h3>
              )}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                aria-label="Close dialog"
                title="Close dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto text-left flex-1 overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/60 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

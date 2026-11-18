import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Klavo Tooltip Component (UX-01)
 */
export const Tooltip = ({ content, children, position = "top", className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && content && (
        <div
          className={`absolute z-50 px-2 py-1 text-[11px] font-medium text-slate-100 bg-slate-950 border border-slate-800 rounded-lg shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-150 ${
            positionClasses[position] || positionClasses.top
          }`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};

/**
 * Klavo Dropdown Component (UX-01)
 */
export const Dropdown = ({
  trigger,
  children,
  align = "right",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute z-40 mt-1.5 min-w-[160px] rounded-xl bg-slate-900 border border-slate-800 shadow-xl py-1.5 focus:outline-none animate-fade-in ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div onClick={() => setIsOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
};

export const DropdownItem = ({ children, onClick, danger = false, icon: Icon, className = "" }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center gap-2 transition ${
        danger
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
          : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
      } ${className}`.trim()}
    >
      {Icon && <Icon size={14} className="shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
};

/**
 * Klavo Table Components (UX-01)
 */
export const Table = ({ children, className = "" }) => {
  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-800 ${className}`}>
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  );
};

export const TableHead = ({ children }) => {
  return <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">{children}</thead>;
};

export const TableBody = ({ children }) => {
  return <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">{children}</tbody>;
};

export const TableRow = ({ children, className = "", onClick }) => {
  return (
    <tr
      onClick={onClick}
      className={`hover:bg-slate-800/25 transition duration-100 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </tr>
  );
};

export const TableCell = ({ children, className = "", align = "left" }) => {
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return <td className={`py-3 px-3.5 text-slate-300 ${alignClass} ${className}`}>{children}</td>;
};

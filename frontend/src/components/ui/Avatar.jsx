import React from "react";

/**
 * Klavo Avatar Component (UX-01)
 *
 * User profile avatar with initials fallback and high-contrast color hashing.
 */
export const Avatar = ({
  src,
  name = "User",
  size = "md",
  className = "",
  status, // 'online' | 'offline' | 'busy'
  ...props
}) => {
  const sizeMap = {
    xs: "w-5 h-5 text-[10px]",
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-11 h-11 text-base",
    xl: "w-14 h-14 text-lg",
  };

  const statusSizeMap = {
    xs: "w-1.5 h-1.5 border",
    sm: "w-2 h-2 border",
    md: "w-2.5 h-2.5 border-2",
    lg: "w-3 h-3 border-2",
    xl: "w-3.5 h-3.5 border-2",
  };

  const getInitials = (str) => {
    if (!str) return "U";
    const parts = str.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  // Deterministic background palette
  const avatarColors = [
    "bg-indigo-600 text-white",
    "bg-emerald-600 text-white",
    "bg-purple-600 text-white",
    "bg-rose-600 text-white",
    "bg-amber-600 text-white",
    "bg-cyan-600 text-white",
  ];

  const getColorClass = (str) => {
    let hash = 0;
    for (let i = 0; i < (str || "").length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % avatarColors.length;
    return avatarColors[idx];
  };

  return (
    <div className={`relative inline-block shrink-0 ${className}`} {...props}>
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          className={`${sizeMap[size] || sizeMap.md} rounded-full object-cover border border-slate-700/60 shadow-sm`}
        />
      ) : (
        <div
          className={`${sizeMap[size] || sizeMap.md} rounded-full flex items-center justify-center font-bold border border-white/10 shadow-sm ${getColorClass(
            name
          )}`}
          title={name}
        >
          {getInitials(name)}
        </div>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-slate-900 ${
            statusSizeMap[size] || statusSizeMap.md
          } ${
            status === "online"
              ? "bg-emerald-400"
              : status === "busy"
              ? "bg-amber-400"
              : "bg-slate-500"
          }`}
        />
      )}
    </div>
  );
};

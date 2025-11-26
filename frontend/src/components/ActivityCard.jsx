import React from "react";

const ActivityCard = ({ status, title, progress, time, user }) => {
  return (
    <div className="w-full max-w-md bg-white shadow-sm rounded-xl p-4 border border-gray-200 mb-3">
      <div className="text-sm font-semibold text-gray-800">
        {status} → <span className="text-blue-600">{title}</span> → {progress}
      </div>

      <div className="flex justify-between text-xs mt-2 text-gray-500">
        <span>{time}</span>
        <span>{user}</span>
      </div>
    </div>
  );
};

export default ActivityCard;

import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { useParams } from "react-router-dom";
import socket from "../socket";

export default function ActivityPanel() {
  const { projectId } = useParams();
  const [activity, setActivity] = useState([]);

  // Fetch initial activity data
  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await axiosClient.get(`/activity/${projectId}`);
        setActivity(res.data);
      } catch (err) {
        console.log(err);
      }
    };

    fetchActivity();
  }, [projectId]);

  // SOCKET.IO — listen for real-time activity updates
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleActivity = (newActivity) => {
      if (String(newActivity.projectId) !== String(projectId)) return;

      // Add new activity to TOP
      setActivity((prev) => [newActivity, ...prev]);
    };

    socket.on("activityCreated", handleActivity);

    return () => {
      socket.off("activityCreated", handleActivity);
    };
  }, [projectId]);

  const getIcon = (action) => {
    if (action?.toLowerCase().includes("moved")) return "🔀";
    if (action?.toLowerCase().includes("created")) return "🆕";
    if (action?.toLowerCase().includes("deleted")) return "🗑️";
    return "📌";
  };

  return (
    <div className="p-6 text-gray-300">
      {activity.length === 0 ? (
        <p className="text-center text-gray-500 text-lg mt-10">
          🚀 No activity yet — start managing tasks!
        </p>
      ) : (
        <div className="space-y-4">
          {activity.map((item) => (
            <div
              key={item._id}
              className="border border-gray-700 rounded-xl p-4 bg-gray-900 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getIcon(item.action)}</span>

                <div className="flex-1">
                  <p className="text-indigo-400 font-semibold text-sm md:text-base">
                    {item.message}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {item.user?.name || "Unknown"} •{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

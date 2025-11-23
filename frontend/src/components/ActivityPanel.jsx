// frontend/src/components/ActivityPanel.jsx
import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return date.toLocaleString();
}

export default function ActivityPanel({ projectId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = async () => {
    try {
      const res = await axiosClient.get(`/activity/project/${projectId}`);
      setLogs(res.data);
    } catch (err) {
      console.error("Failed to load activity:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      fetchActivity();
    }
  }, [projectId]);

  if (loading) {
    return <div className="p-4">Loading activity...</div>;
  }

  if (!logs.length) {
    return <div className="p-4 text-sm text-slate-500">No activity yet.</div>;
  }

  return (
    <div className="app-card p-4 rounded-xl shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Activity Log</h2>

      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        {logs.map((log) => (
          <div key={log._id} className="flex items-start gap-3 text-sm">
            <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />
            <div>
              <div className="font-medium">
                {log.user?.name || "Someone"}
                <span className="ml-1 font-normal text-slate-600">
                  {log.message}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {timeAgo(log.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

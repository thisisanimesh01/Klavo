import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { Link } from "react-router-dom";
import socket from "../socket";
import { useSelector } from "react-redux";
import OnboardingChecklist from "../components/OnboardingChecklist";
import FirstLoginWizardModal from "../components/FirstLoginWizardModal";
import { useOnboarding } from "../context/OnboardingContext";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  const authUser = useSelector((state) => state.auth?.user);
  const { state: onboardingState, completeStep } = useOnboarding();

  const loadStats = async () => {
    try {
      const { data } = await axiosClient.get("/dashboard");
      setStats(data);
      if (Array.isArray(data.recentActivity)) {
        setRecentActivities(data.recentActivity);
      }
    } catch (err) {
      console.error("Dashboard stats failed to load:", err);
    } finally {
      setLoading(false);
    }
  };

  // Detect first-login for new users (0 teams, 0 projects, not previously dismissed or completed)
  useEffect(() => {
    if (stats && !loading) {
      if (
        stats.teamCount === 0 &&
        stats.projectCount === 0 &&
        !onboardingState.completed &&
        !onboardingState.dismissed
      ) {
        setShowWizard(true);
      }
    }
  }, [stats, loading, onboardingState.completed, onboardingState.dismissed]);

  useEffect(() => {
    loadStats();

    if (!socket.connected) socket.connect();

    const handleRealtimeActivity = (newActivity) => {
      setRecentActivities((prev) => [newActivity, ...prev.slice(0, 9)]);
      // Refresh metrics on relevant project events
      loadStats();
    };

    socket.on("activityCreated", handleRealtimeActivity);
    socket.on("taskCreated", loadStats);
    socket.on("taskMoved", loadStats);
    socket.on("taskDeleted", loadStats);

    return () => {
      socket.off("activityCreated", handleRealtimeActivity);
      socket.off("taskCreated", loadStats);
      socket.off("taskMoved", loadStats);
      socket.off("taskDeleted", loadStats);
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const colors = ["#6366F1", "#F59E0B", "#10B981"];

  const getActivityIcon = (action) => {
    if (!action) return "📌";
    const act = action.toLowerCase();
    if (act.includes("moved")) return "🔀";
    if (act.includes("created")) return "🆕";
    if (act.includes("deleted")) return "🗑️";
    if (act.includes("file") || act.includes("upload")) return "📁";
    if (act.includes("comment")) return "💬";
    return "📌";
  };

  return (
    <div className="space-y-6" style={{ color: "var(--text-main)" }}>
      {/* Onboarding Checklist (UX-08) */}
      <OnboardingChecklist userRole={authUser?.role || "member"} />

      {/* First-Login Setup Wizard Modal (UX-08) */}
      <FirstLoginWizardModal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={() => {
          setShowWizard(false);
          loadStats();
        }}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard label="Projects" value={stats.projectCount} />
        <StatCard label="Tasks" value={stats.taskCount} />
        <StatCard label="Completed" value={stats.completedCount} color="text-green-500" />
        <StatCard label="Teams" value={stats.teamCount} />
      </div>

      {/* Visual Graphs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <div
          className="p-4 rounded-xl shadow"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--card-border)",
          }}
        >
          <h2 className="font-semibold mb-3">Weekly Task Activity</h2>

          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={stats.weeklyActivity}>
              <defs>
                <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="var(--card-border)" />
              <XAxis dataKey="_id" tick={{ fill: "var(--text-main)" }} />
              <YAxis tick={{ fill: "var(--text-main)" }} allowDecimals={false} />

              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--card-border)",
                  color: "var(--text-main)",
                }}
              />

              <Area
                type="monotone"
                dataKey="count"
                stroke="#6366F1"
                fillOpacity={1}
                fill="url(#colorActivity)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Task Status */}
        <div
          className="p-4 rounded-xl shadow"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--card-border)",
          }}
        >
          <h2 className="font-semibold mb-3">Task Status Breakdown</h2>

          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats.statusDistribution}
                dataKey="count"
                nameKey="_id"
                cx="50%"
                cy="50%"
                outerRadius={80}
              >
                {stats.statusDistribution.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>

              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--card-border)",
                  color: "var(--text-main)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Team Activity Feed */}
      <div
        className="p-5 rounded-xl shadow"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--card-border)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Recent Team Activity</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Live updates across authorized projects
          </span>
        </div>

        {recentActivities.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
            🚀 No recent team activity yet. Create a task or upload files to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {recentActivities.map((act, idx) => (
              <div
                key={act._id || idx}
                className="flex items-center justify-between p-3 rounded-lg border text-sm"
                style={{
                  background: "var(--bg-main)",
                  borderColor: "var(--card-border)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">{getActivityIcon(act.action)}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{act.message}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {act.user?.name || "Team Member"}
                      {act.projectId?.name ? ` • Project: ${act.projectId.name}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-xs shrink-0 ml-4" style={{ color: "var(--text-muted)" }}>
                  {act.createdAt
                    ? new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "Just now"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 sm:gap-4 pt-2">
        <Link
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 sm:px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm text-center flex-1 sm:flex-none min-h-[44px] flex items-center justify-center"
          to="/teams"
        >
          Manage Teams
        </Link>

        <Link
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm text-center flex-1 sm:flex-none min-h-[44px] flex items-center justify-center"
          to="/projects"
        >
          Manage Projects
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "" }) {
  return (
    <div
      className="p-5 rounded-xl shadow text-center"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--card-border)",
        color: "var(--text-main)",
      }}
    >
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

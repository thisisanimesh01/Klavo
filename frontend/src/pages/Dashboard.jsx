import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import Topbar from "../components/Topbar";
import { Link } from "react-router-dom";

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
  ResponsiveContainer
} from "recharts";

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      const { data } = await axiosClient.get("/dashboard");
      setStats(data);
    };
    loadStats();
  }, []);

  if (!stats) return <p className="p-6">Loading...</p>;

  const colors = ["#6366F1", "#10B981", "#EF4444"];

  return (
    <div
      className="min-h-screen px-6 py-4"
      style={{ background: "var(--bg-main)", color: "var(--text-main)" }}
    >
      <Topbar />

      <div className="mt-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard label="Projects" value={stats.projectCount} />
          <StatCard label="Tasks" value={stats.taskCount} />
          <StatCard label="Completed" value={stats.completedCount} color="text-green-500" />
          <StatCard label="Teams" value={stats.teamCount} />
        </div>

        {/* Graphs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Weekly Activity */}
          <div
            className="p-4 rounded-xl shadow"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--card-border)"
            }}
          >
            <h2 className="font-semibold mb-3">Weekly Task Activity</h2>

            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats.weeklyActivity}>
                <defs>
                  <linearGradient id="color" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke="var(--card-border)" />

                <XAxis dataKey="_id" tick={{ fill: "var(--text-main)" }} />
                <YAxis tick={{ fill: "var(--text-main)" }} />

                <Tooltip
                  contentStyle={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--card-border)",
                    color: "var(--text-main)"
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#6366F1"
                  fillOpacity={1}
                  fill="url(#color)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Task Status */}
          <div
            className="p-4 rounded-xl shadow"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--card-border)"
            }}
          >
            <h2 className="font-semibold mb-3">Task Status</h2>

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
                    <Cell key={i} fill={colors[i]} />
                  ))}
                </Pie>

                <Tooltip
                  contentStyle={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--card-border)",
                    color: "var(--text-main)"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* Buttons */}
        <div className="flex gap-6 mt-8">
          <Link className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-lg font-semibold" to="/teams">
            Create Teams
          </Link>

          <Link className="bg-blue-600 text-white px-8 py-3 rounded-xl text-lg font-semibold" to="/projects">
            Manage Projects
          </Link>
        </div>
      </div>

    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div
      className="p-5 rounded-xl shadow text-center"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--card-border)",
        color: "var(--text-main)"
      }}
    >
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className={`text-3xl font-bold ${color}`} style={{ color: "var(--text-main)" }}>
        {value}
      </p>
    </div>
  );
}

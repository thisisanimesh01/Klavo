import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { BarChart3, TrendingUp, CheckCircle, ListTodo, AlertCircle } from "lucide-react";
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

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axiosClient.get("/dashboard");
        setData(res.data);
      } catch (err) {
        console.error("Failed to load analytics:", err);
        setError("Failed to load project analytics data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444"];

  const completionRate =
    data && data.taskCount > 0
      ? Math.round((data.completedCount / data.taskCount) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="text-indigo-400" size={28} />
          Team Performance & Analytics
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Real-time metrics, task velocity, and workflow status across your active teams.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className="p-5 rounded-xl border shadow-sm"
              style={{ background: "var(--bg-card)", borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>Total Tasks</span>
                <ListTodo className="text-indigo-400" size={20} />
              </div>
              <p className="text-3xl font-bold mt-2">{data.taskCount}</p>
            </div>

            <div
              className="p-5 rounded-xl border shadow-sm"
              style={{ background: "var(--bg-card)", borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>Completed</span>
                <CheckCircle className="text-emerald-400" size={20} />
              </div>
              <p className="text-3xl font-bold mt-2 text-emerald-400">{data.completedCount}</p>
            </div>

            <div
              className="p-5 rounded-xl border shadow-sm"
              style={{ background: "var(--bg-card)", borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>Completion Rate</span>
                <TrendingUp className="text-blue-400" size={20} />
              </div>
              <p className="text-3xl font-bold mt-2 text-blue-400">{completionRate}%</p>
            </div>

            <div
              className="p-5 rounded-xl border shadow-sm"
              style={{ background: "var(--bg-card)", borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>Active Projects</span>
                <BarChart3 className="text-purple-400" size={20} />
              </div>
              <p className="text-3xl font-bold mt-2 text-purple-400">{data.projectCount}</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Activity */}
            <div
              className="p-5 rounded-xl border shadow-sm"
              style={{ background: "var(--bg-card)", borderColor: "var(--card-border)" }}
            >
              <h3 className="font-semibold mb-4">Task Creation Velocity</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.weeklyActivity || []}>
                    <defs>
                      <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--card-border)" opacity={0.3} />
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
                      fill="url(#velocityGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Task Status Distribution */}
            <div
              className="p-5 rounded-xl border shadow-sm"
              style={{ background: "var(--bg-card)", borderColor: "var(--card-border)" }}
            >
              <h3 className="font-semibold mb-4">Task Status Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.statusDistribution || []}
                      dataKey="count"
                      nameKey="_id"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {(data.statusDistribution || []).map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
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
          </div>
        </>
      )}
    </div>
  );
}

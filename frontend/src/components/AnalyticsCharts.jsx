import React from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";

const DEFAULT_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

/**
 * Task Status Breakdown Pie/Donut Chart
 */
export function StatusDistributionChart({ data = [] }) {
  const chartData = (data || []).filter((d) => d.count > 0);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No task status data available</p>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={4}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`status-cell-${index}`}
                fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--bg-card, #1e293b)",
              border: "1px solid var(--card-border, #334155)",
              borderRadius: "8px",
              color: "var(--text-main, #f8fafc)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Task Priority Distribution Bar Chart
 */
export function PriorityDistributionChart({ data = [] }) {
  const chartData = (data || []).map((d) => ({
    name: d.label || d.priority,
    count: d.count,
    color: d.color,
  }));

  const hasData = chartData.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No task priority data available</p>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card, #1e293b)",
              border: "1px solid var(--card-border, #334155)",
              borderRadius: "8px",
              color: "var(--text-main, #f8fafc)",
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`prio-cell-${index}`} fill={entry.color || "#6366F1"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Team Member Workload Allocation Chart
 */
export function WorkloadDistributionChart({ data = [] }) {
  const chartData = (data || []).map((m) => ({
    name: m.name?.split(" ")[0] || "Member",
    completed: m.completed,
    pending: m.pending,
    overdue: m.overdue,
  }));

  if (chartData.length === 0 || !chartData.some((d) => d.completed > 0 || d.pending > 0)) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No team workload data available</p>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card, #1e293b)",
              border: "1px solid var(--card-border, #334155)",
              borderRadius: "8px",
              color: "var(--text-main, #f8fafc)",
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "12px" }}>{value}</span>
            )}
          />
          <Bar dataKey="completed" name="Completed" stackId="a" fill="#10B981" />
          <Bar dataKey="pending" name="Pending" stackId="a" fill="#3B82F6" />
          <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Weekly Creation Activity / Velocity Area Chart
 */
export function VelocityChart({ data = [] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#6366F1" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="_id" tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card, #1e293b)",
              border: "1px solid var(--card-border, #334155)",
              borderRadius: "8px",
              color: "var(--text-main, #f8fafc)",
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#6366F1"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#velocityGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Sprint Velocity Historical Comparison Chart (Committed vs Completed Work)
 */
export function SprintVelocityChart({ data = [], unitLabel = "Hours" }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No sprint velocity history available</p>
        <span className="text-xs text-slate-500 mt-1">Create and complete sprints to see velocity trends</span>
      </div>
    );
  }

  const chartData = data.map((s) => ({
    name: s.sprintName,
    committed: s.committed,
    completed: s.completed,
    status: s.status,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 11 }}
            angle={-20}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }}
            allowDecimals={false}
            unit={` ${unitLabel.slice(0, 1)}`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card, #1e293b)",
              border: "1px solid var(--card-border, #334155)",
              borderRadius: "8px",
              color: "var(--text-main, #f8fafc)",
            }}
            formatter={(value, name) => [`${value} ${unitLabel}`, name === "committed" ? "Committed Work" : "Completed (Velocity)"]}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "12px" }}>
                {value === "committed" ? "Committed" : "Completed Velocity"}
              </span>
            )}
          />
          <Bar dataKey="committed" fill="#64748B" radius={[4, 4, 0, 0]} opacity={0.8} />
          <Bar dataKey="completed" fill="#10B981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Sprint Burndown Chart (Ideal Line vs Actual Remaining Work)
 */
export function SprintBurndownChart({ timeline = [], unitLabel = "Hours" }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No burndown timeline available for this sprint</p>
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={timeline} margin={{ top: 10, right: 15, left: -15, bottom: 20 }}>
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 11 }}
            angle={-20}
            textAnchor="end"
          />
          <YAxis
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }}
            allowDecimals={false}
            unit={` ${unitLabel.slice(0, 1)}`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card, #1e293b)",
              border: "1px solid var(--card-border, #334155)",
              borderRadius: "8px",
              color: "var(--text-main, #f8fafc)",
            }}
            formatter={(val, name) => (val !== null ? [`${val} ${unitLabel}`, name === "ideal" ? "Ideal Guideline" : "Actual Remaining"] : ["N/A (Future)", name])}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "12px" }}>
                {value === "ideal" ? "Ideal Burndown Guideline" : "Actual Remaining Work"}
              </span>
            )}
          />
          <Line
            type="linear"
            dataKey="ideal"
            stroke="#94A3B8"
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3B82F6"
            strokeWidth={3}
            dot={{ r: 3, fill: "#3B82F6" }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

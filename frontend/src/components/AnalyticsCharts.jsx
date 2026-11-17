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

/**
 * Team Member Capacity vs Committed Work Allocation Chart (ANL-03)
 */
export function TeamCapacityComparisonChart({ members = [], unitLabel = "Hours" }) {
  if (!members || members.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No member capacity data available</p>
      </div>
    );
  }

  const chartData = members.map((m) => ({
    name: m.name?.split(" ")[0] || "Member",
    committed: m.committedWork,
    capacity: m.capacity,
    isOverAllocated: m.isOverAllocated,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 25 }}>
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
            formatter={(value, name) => [`${value} ${unitLabel}`, name === "capacity" ? "Available Capacity" : "Committed Work"]}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "12px" }}>
                {value === "capacity" ? "Configured Capacity" : "Committed Work"}
              </span>
            )}
          />
          <Bar dataKey="capacity" fill="#64748B" radius={[4, 4, 0, 0]} opacity={0.6} />
          <Bar dataKey="committed" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`committed-cell-${index}`}
                fill={entry.isOverAllocated ? "#EF4444" : "#3B82F6"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Team Workload Status Split Chart (Completed vs Pending per member) (ANL-03)
 */
export function MemberTaskStatusBreakdownChart({ members = [] }) {
  if (!members || members.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No task distribution data available</p>
      </div>
    );
  }

  const chartData = members.map((m) => ({
    name: m.name?.split(" ")[0] || "Member",
    completed: m.completedCount,
    pending: m.pendingCount,
    overdue: m.overdueCount,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 25 }}>
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 11 }}
            angle={-20}
            textAnchor="end"
            interval={0}
          />
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
 * Task Completion Trends Chart (Day, Week, Month Area chart) (ANL-04)
 */
export function TaskCompletionTrendsChart({ data = [], granularity = "daily" }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No completion trends recorded for this period</p>
      </div>
    );
  }

  const dateKey = granularity === "weekly" ? "label" : granularity === "monthly" ? "month" : "date";

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 25 }}>
          <defs>
            <linearGradient id="completionAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey={dateKey}
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 11 }}
            angle={-20}
            textAnchor="end"
            interval="preserveStartEnd"
          />
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
            name="Tasks Completed"
            stroke="#10B981"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#completionAreaGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Cycle Time vs Lead Time Percentile Comparison Bar Chart (ANL-04)
 */
export function CycleLeadTimeComparisonChart({ cycleStats = null, leadStats = null }) {
  const hasCycle = cycleStats && cycleStats.count > 0;
  const hasLead = leadStats && leadStats.count > 0;

  if (!hasCycle && !hasLead) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No historical cycle or lead time data recorded yet</p>
        <span className="text-xs text-slate-500 mt-1">Requires completed tasks with start and finish timestamps</span>
      </div>
    );
  }

  const comparisonData = [
    {
      metric: "Average",
      cycleTime: cycleStats?.average ?? 0,
      leadTime: leadStats?.average ?? 0,
    },
    {
      metric: "Median (p50)",
      cycleTime: cycleStats?.median ?? 0,
      leadTime: leadStats?.median ?? 0,
    },
    {
      metric: "85th %ile",
      cycleTime: cycleStats?.p85 ?? 0,
      leadTime: leadStats?.p85 ?? 0,
    },
    {
      metric: "95th %ile",
      cycleTime: cycleStats?.p95 ?? 0,
      leadTime: leadStats?.p95 ?? 0,
    },
  ];

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={comparisonData} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="metric" tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 11 }} />
          <YAxis
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }}
            unit="h"
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card, #1e293b)",
              border: "1px solid var(--card-border, #334155)",
              borderRadius: "8px",
              color: "var(--text-main, #f8fafc)",
            }}
            formatter={(val) => [`${val} hrs`, ""]}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "12px" }}>
                {value === "cycleTime" ? "Cycle Time (Start → Done)" : "Lead Time (Create → Done)"}
              </span>
            )}
          />
          <Bar dataKey="cycleTime" fill="#6366F1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="leadTime" fill="#EC4899" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Stage Bottleneck Duration Bar Chart (ANL-04)
 */
export function StageBottleneckChart({ stageBottlenecks = [] }) {
  if (!stageBottlenecks || stageBottlenecks.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No stage transition history recorded yet</p>
      </div>
    );
  }

  const chartData = stageBottlenecks.map((s) => ({
    name: s.name,
    avgHours: s.averageHours,
    totalHours: s.totalHours,
    taskCount: s.taskCount,
    color: s.color || "#6366f1",
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 25 }}>
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 11 }}
            angle={-15}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }}
            unit="h"
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card, #1e293b)",
              border: "1px solid var(--card-border, #334155)",
              borderRadius: "8px",
              color: "var(--text-main, #f8fafc)",
            }}
            formatter={(val, name, item) => [
              `${val} hrs avg (${item.payload.taskCount} tasks, ${item.payload.totalHours}h total)`,
              "Average Time in Stage",
            ]}
          />
          <Bar dataKey="avgHours" name="Avg Hours in Stage" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-bottleneck-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Health Score Radial Gauge Widget (ANL-05)
 */
export function HealthScoreGauge({ score = null, state = "Insufficient Data", color = "#94a3b8" }) {
  if (score === null) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="w-28 h-28 rounded-full border-4 border-dashed border-slate-700 flex flex-col items-center justify-center">
          <span className="text-xs font-semibold text-slate-400">N/A</span>
        </div>
        <span className="mt-3 text-sm font-semibold text-slate-400">{state}</span>
        <span className="text-xs text-slate-500 mt-1 max-w-[200px]">Add tasks to initialize telemetry</span>
      </div>
    );
  }

  // Radius 45, Circumference = 2 * PI * 45 = ~282.7
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="#1e293b"
            strokeWidth="9"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={color}
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-slate-100">{score}</span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Score</span>
        </div>
      </div>
      <span
        className="mt-3 text-sm font-bold px-3 py-0.5 rounded-full border"
        style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
      >
        {state}
      </span>
    </div>
  );
}

/**
 * Milestone Progress Horizontal Bar Chart (ANL-05)
 */
export function MilestoneProgressChart({ milestones = [] }) {
  if (!milestones || milestones.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No project milestones configured yet</p>
      </div>
    );
  }

  const chartData = milestones.map((m) => ({
    name: m.name,
    completionRate: m.completionRate,
    isOverdue: m.isOverdue,
    color: m.isOverdue ? "#EF4444" : m.completionRate === 100 ? "#10B981" : "#6366F1",
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
        >
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 11 }}
            width={100}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card, #1e293b)",
              border: "1px solid var(--card-border, #334155)",
              borderRadius: "8px",
              color: "var(--text-main, #f8fafc)",
            }}
            formatter={(val, name, item) => [
              `${val}% completed ${item.payload.isOverdue ? "(Overdue)" : ""}`,
              "Milestone Progress",
            ]}
          />
          <Bar dataKey="completionRate" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-m-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Custom Report Breakdown Bar Chart (ANL-06)
 */
export function CustomReportBarChart({ groups = [], metric = "count" }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No group data matches the current report filters</p>
      </div>
    );
  }

  const metricLabel =
    metric === "estimatedHours"
      ? "Estimated Hours"
      : metric === "storyPoints"
      ? "Story Points"
      : metric === "completedCount"
      ? "Completed Tasks"
      : "Task Count";

  const chartData = groups.map((g, i) => ({
    name: g.label,
    value: g[metric] || 0,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 25 }}>
          <CartesianGrid stroke="var(--card-border, #334155)" strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 11 }}
            angle={-15}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: "var(--text-muted, #94a3b8)", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card, #1e293b)",
              border: "1px solid var(--card-border, #334155)",
              borderRadius: "8px",
              color: "var(--text-main, #f8fafc)",
            }}
            formatter={(val) => [val, metricLabel]}
          />
          <Bar dataKey="value" name={metricLabel} radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-report-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Custom Report Pie Distribution Chart (ANL-06)
 */
export function CustomReportPieChart({ groups = [], metric = "count" }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No group distribution data matches the current report filters</p>
      </div>
    );
  }

  const chartData = groups.map((g, i) => ({
    name: g.label,
    value: g[metric] || 0,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-pie-${index}`} fill={entry.color} />
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
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "11px" }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

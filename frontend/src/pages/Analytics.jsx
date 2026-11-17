import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import {
  BarChart3,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  UserX,
  Calendar,
  Layers,
  ArrowLeft,
  Users,
  Activity as ActivityIcon,
  Filter,
  RefreshCw,
  FolderKanban,
} from "lucide-react";
import {
  StatusDistributionChart,
  PriorityDistributionChart,
  WorkloadDistributionChart,
  VelocityChart,
} from "../components/AnalyticsCharts";

export default function Analytics() {
  const { projectId: urlProjectId } = useParams();
  const navigate = useNavigate();

  // Project selection & multi-project support
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || "");

  // Analytics data states
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [dateRange, setDateRange] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Load available projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axiosClient.get("/projects");
        const projectList = res.data || [];
        setProjects(projectList);

        if (!selectedProjectId && projectList.length > 0) {
          setSelectedProjectId(projectList[0]._id);
        }
      } catch (err) {
        console.error("Failed to load user projects:", err);
      }
    };
    fetchProjects();
  }, [selectedProjectId]);

  // Sync state if urlProjectId changes
  useEffect(() => {
    if (urlProjectId) {
      setSelectedProjectId(urlProjectId);
    }
  }, [urlProjectId]);

  // Fetch project analytics
  const fetchAnalytics = useCallback(async () => {
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = { range: dateRange };
      if (dateRange === "custom") {
        if (customStartDate) params.startDate = customStartDate;
        if (customEndDate) params.endDate = customEndDate;
      }

      const res = await axiosClient.get(`/analytics/project/${selectedProjectId}`, { params });
      setData(res.data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError(err.response?.data?.message || "Failed to load project analytics data.");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleProjectChange = (e) => {
    const newProjectId = e.target.value;
    setSelectedProjectId(newProjectId);
    navigate(`/analytics/${newProjectId}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {urlProjectId && (
              <button
                onClick={() => navigate(`/kanban/${urlProjectId}`)}
                className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
                title="Back to Kanban"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="text-indigo-400" size={28} />
              Project Analytics Dashboard
            </h1>
          </div>
          <p className="text-sm mt-1 text-slate-400">
            Real-time project velocity, workload distribution, and completion metrics.
          </p>
        </div>

        {/* Global Controls: Project selector, Range dropdown, Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Project Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
            <FolderKanban size={16} className="text-indigo-400" />
            <select
              value={selectedProjectId}
              onChange={handleProjectChange}
              className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer"
            >
              {projects.length === 0 ? (
                <option value="">No projects available</option>
              ) : (
                projects.map((p) => (
                  <option key={p._id} value={p._id} className="bg-slate-900 text-slate-200">
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
            <Filter size={16} className="text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-200">All Time</option>
              <option value="today" className="bg-slate-900 text-slate-200">Today</option>
              <option value="this_week" className="bg-slate-900 text-slate-200">This Week</option>
              <option value="this_month" className="bg-slate-900 text-slate-200">This Month</option>
              <option value="last_30_days" className="bg-slate-900 text-slate-200">Last 30 Days</option>
              <option value="custom" className="bg-slate-900 text-slate-200">Custom Date Range</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition disabled:opacity-50"
            title="Refresh analytics"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Custom Date Pickers */}
      {dateRange === "custom" && (
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-indigo-400" />
            <span className="text-slate-400">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-16">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-slate-400">Aggregating project analytics...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-3">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Empty project state */}
      {!loading && !error && (!selectedProjectId || projects.length === 0) && (
        <div className="text-center p-16 border border-slate-800 rounded-2xl bg-slate-900/40">
          <BarChart3 className="mx-auto text-slate-500 mb-3" size={48} />
          <h3 className="text-lg font-semibold text-slate-200">No Projects Found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            You don't have access to any projects yet or no projects have been created in your teams.
          </p>
          <button
            onClick={() => navigate("/projects")}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition"
          >
            Go to Projects
          </button>
        </div>
      )}

      {/* Analytics Dashboard Content */}
      {!loading && !error && data && (
        <>
          {/* Key Metric Highlights / KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Total Tasks */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Total Tasks</span>
                <Layers className="text-indigo-400" size={18} />
              </div>
              <p className="text-2xl font-bold mt-2 text-slate-100">{data.taskCount}</p>
              <span className="text-xs text-slate-500 mt-1 block">Project Scope</span>
            </div>

            {/* Completed Tasks */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
                <CheckCircle className="text-emerald-400" size={18} />
              </div>
              <p className="text-2xl font-bold mt-2 text-emerald-400">{data.completedCount}</p>
              <span className="text-xs text-emerald-500/80 mt-1 block">
                {data.completionRate}% completion
              </span>
            </div>

            {/* In Progress Tasks */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">In Progress</span>
                <Clock className="text-blue-400" size={18} />
              </div>
              <p className="text-2xl font-bold mt-2 text-blue-400">{data.inProgressCount}</p>
              <span className="text-xs text-slate-500 mt-1 block">Active Execution</span>
            </div>

            {/* Overdue Tasks */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Overdue</span>
                <AlertTriangle className="text-red-400" size={18} />
              </div>
              <p className="text-2xl font-bold mt-2 text-red-400">{data.overdueCount}</p>
              <span className="text-xs text-red-500/80 mt-1 block">Past deadline</span>
            </div>

            {/* Unassigned Tasks */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Unassigned</span>
                <UserX className="text-amber-400" size={18} />
              </div>
              <p className="text-2xl font-bold mt-2 text-amber-400">{data.unassignedCount}</p>
              <span className="text-xs text-slate-500 mt-1 block">Needs allocation</span>
            </div>

            {/* Progress Rate */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Progress</span>
                <TrendingUp className="text-purple-400" size={18} />
              </div>
              <p className="text-2xl font-bold mt-2 text-purple-400">{data.completionRate}%</p>
              {/* Mini progress bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${data.completionRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* First Chart Grid: Status & Priority Distributions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Breakdown */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-200">Status Distribution</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Workflow status allocation of tasks</p>
                </div>
              </div>
              <StatusDistributionChart data={data.statusDistribution} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-800">
                {data.statusDistribution?.map((st) => (
                  <div key={st._id} className="text-center p-2 rounded-lg bg-slate-800/40">
                    <span className="text-xs text-slate-400 block truncate">{st.label}</span>
                    <span className="text-base font-bold text-slate-200">{st.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Breakdown */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-200">Priority Breakdown</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Urgency and importance tiers</p>
                </div>
              </div>
              <PriorityDistributionChart data={data.priorityDistribution} />
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4 pt-4 border-t border-slate-800">
                {data.priorityDistribution?.map((p) => (
                  <div key={p._id} className="text-center p-2 rounded-lg bg-slate-800/40">
                    <span className="text-xs text-slate-400 block truncate">{p.label}</span>
                    <span className="text-base font-bold text-slate-200">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Second Chart Grid: Workload Overview & Velocity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Member Workload */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Users size={18} className="text-indigo-400" />
                    Team Member Workload
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Completed vs pending tasks per team member
                  </p>
                </div>
              </div>
              <WorkloadDistributionChart data={data.teamWorkload} />
            </div>

            {/* Weekly Velocity */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <ActivityIcon size={18} className="text-purple-400" />
                    Task Creation Velocity
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    New tasks registered across days of the week
                  </p>
                </div>
              </div>
              <VelocityChart data={data.weeklyActivity} />
            </div>
          </div>

          {/* Bottom Grid: Team Workload Table & Recent Activity Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Workload Summary Table */}
            <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
              <h3 className="font-semibold text-slate-200 mb-3">Workload Summary by Assignee</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 font-medium">Member</th>
                      <th className="pb-3 font-medium text-center">Total</th>
                      <th className="pb-3 font-medium text-center">Completed</th>
                      <th className="pb-3 font-medium text-center">Pending</th>
                      <th className="pb-3 font-medium text-center">Overdue</th>
                      <th className="pb-3 font-medium text-right">Completion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {data.teamWorkload && data.teamWorkload.length > 0 ? (
                      data.teamWorkload.map((m) => {
                        const rate = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                        return (
                          <tr key={m.userId} className="hover:bg-slate-800/20">
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                                  {m.name.charAt(0)}
                                </div>
                                <div>
                                  <span className="font-medium text-slate-200 block text-xs sm:text-sm">
                                    {m.name}
                                  </span>
                                  {m.email && (
                                    <span className="text-xs text-slate-500 block truncate max-w-[150px]">
                                      {m.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 text-center text-slate-300 font-semibold">{m.total}</td>
                            <td className="py-3 text-center text-emerald-400">{m.completed}</td>
                            <td className="py-3 text-center text-blue-400">{m.pending}</td>
                            <td className="py-3 text-center text-red-400 font-medium">
                              {m.overdue > 0 ? m.overdue : "0"}
                            </td>
                            <td className="py-3 text-right">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300">
                                {rate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          No team member workload recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Project Activity Stream */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col">
              <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <ActivityIcon size={18} className="text-indigo-400" />
                Recent Project Activity
              </h3>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-80 pr-1">
                {data.recentActivity && data.recentActivity.length > 0 ? (
                  data.recentActivity.map((act) => (
                    <div
                      key={act._id}
                      className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-medium text-slate-300">{act.user?.name || "System"}</span>
                        <span>
                          {act.createdAt
                            ? new Date(act.createdAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="text-slate-300">{act.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    No recent activity logged for this project.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

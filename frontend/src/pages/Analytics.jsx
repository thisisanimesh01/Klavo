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
  Flame,
  Zap,
  Target,
  ArrowUpRight,
  HelpCircle,
  Scale,
} from "lucide-react";
import {
  StatusDistributionChart,
  PriorityDistributionChart,
  WorkloadDistributionChart,
  VelocityChart,
  SprintVelocityChart,
  SprintBurndownChart,
} from "../components/AnalyticsCharts";

export default function Analytics() {
  const { projectId: urlProjectId } = useParams();
  const navigate = useNavigate();

  // Navigation tab: 'overview' | 'sprints'
  const [activeTab, setActiveTab] = useState("overview");

  // Project selection & multi-project support
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || "");

  // Measurement unit: 'estimatedHours' or 'storyPoints'
  const [measurementUnit, setMeasurementUnit] = useState("estimatedHours");

  // Overall analytics data states
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states for Overview
  const [dateRange, setDateRange] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Sprint Velocity & Burndown states
  const [projectSprints, setProjectSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [velocityData, setVelocityData] = useState(null);
  const [burndownData, setBurndownData] = useState(null);
  const [sprintLoading, setSprintLoading] = useState(false);
  const [sprintError, setSprintError] = useState(null);

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

  // Fetch project analytics (Overview)
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

  // Fetch sprints list for the project
  const fetchSprints = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const res = await axiosClient.get(`/sprints/project/${selectedProjectId}`);
      const list = res.data || [];
      setProjectSprints(list);

      // Select active sprint first, or latest sprint
      if (list.length > 0) {
        const active = list.find((s) => s.status === "active");
        setSelectedSprintId((prev) => (prev && list.some((s) => s._id === prev) ? prev : (active ? active._id : list[0]._id)));
      } else {
        setSelectedSprintId("");
      }
    } catch (err) {
      console.error("Failed to load project sprints:", err);
    }
  }, [selectedProjectId]);

  // Fetch sprint velocity and burndown
  const fetchSprintAnalytics = useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      setSprintLoading(true);
      setSprintError(null);

      // 1. Fetch velocity comparison
      const velRes = await axiosClient.get(`/analytics/project/${selectedProjectId}/velocity`, {
        params: { unit: measurementUnit },
      });
      setVelocityData(velRes.data);

      // 2. Fetch burndown if a sprint is selected
      if (selectedSprintId) {
        const burnRes = await axiosClient.get(`/analytics/sprint/${selectedSprintId}/burndown`, {
          params: { unit: measurementUnit },
        });
        setBurndownData(burnRes.data);
      } else {
        setBurndownData(null);
      }
    } catch (err) {
      console.error("Failed to load sprint analytics:", err);
      setSprintError(err.response?.data?.message || "Failed to load sprint analytics.");
    } finally {
      setSprintLoading(false);
    }
  }, [selectedProjectId, selectedSprintId, measurementUnit]);

  useEffect(() => {
    fetchAnalytics();
    fetchSprints();
  }, [fetchAnalytics, fetchSprints]);

  useEffect(() => {
    if (activeTab === "sprints") {
      fetchSprintAnalytics();
    }
  }, [activeTab, fetchSprintAnalytics]);

  const handleProjectChange = (e) => {
    const newProjectId = e.target.value;
    setSelectedProjectId(newProjectId);
    navigate(`/analytics/${newProjectId}`);
  };

  const unitLabel = measurementUnit === "storyPoints" ? "Story Points" : "Hours";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Project Controls */}
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
            Real-time project overview, sprint burndown, velocity trends, and workload metrics.
          </p>
        </div>

        {/* Global Project Selector & Refresh */}
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

          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchAnalytics();
              if (activeTab === "sprints") fetchSprintAnalytics();
            }}
            disabled={loading || sprintLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition disabled:opacity-50"
            title="Refresh analytics"
          >
            <RefreshCw size={16} className={loading || sprintLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Overview vs Sprints & Burndown) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Layers size={16} />
            <span>Project Overview</span>
          </button>

          <button
            onClick={() => setActiveTab("sprints")}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition flex items-center gap-2 ${
              activeTab === "sprints"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Flame size={16} className="text-amber-400" />
            <span>Sprint Velocity & Burndown</span>
          </button>
        </div>

        {/* Tab Specific Toolbar */}
        {activeTab === "overview" && (
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
            <Filter size={15} className="text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-200">All Time</option>
              <option value="today" className="bg-slate-900 text-slate-200">Today</option>
              <option value="this_week" className="bg-slate-900 text-slate-200">This Week</option>
              <option value="this_month" className="bg-slate-900 text-slate-200">This Month</option>
              <option value="last_30_days" className="bg-slate-900 text-slate-200">Last 30 Days</option>
              <option value="custom" className="bg-slate-900 text-slate-200">Custom Range</option>
            </select>
          </div>
        )}

        {activeTab === "sprints" && (
          <div className="flex items-center gap-3">
            {/* Measurement Unit Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                onClick={() => setMeasurementUnit("estimatedHours")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  measurementUnit === "estimatedHours"
                    ? "bg-indigo-600 text-white font-medium"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Hours
              </button>
              <button
                onClick={() => setMeasurementUnit("storyPoints")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  measurementUnit === "storyPoints"
                    ? "bg-indigo-600 text-white font-medium"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Story Points
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PROJECT OVERVIEW (ANL-01) */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <>
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

          {loading && (
            <div className="flex flex-col items-center justify-center p-16">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-sm text-slate-400">Aggregating project analytics...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-3">
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Key Metric Highlights / KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">Total Tasks</span>
                    <Layers className="text-indigo-400" size={18} />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-slate-100">{data.taskCount}</p>
                  <span className="text-xs text-slate-500 mt-1 block">Project Scope</span>
                </div>

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

                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">In Progress</span>
                    <Clock className="text-blue-400" size={18} />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-blue-400">{data.inProgressCount}</p>
                  <span className="text-xs text-slate-500 mt-1 block">Active Execution</span>
                </div>

                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">Overdue</span>
                    <AlertTriangle className="text-red-400" size={18} />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-red-400">{data.overdueCount}</p>
                  <span className="text-xs text-red-500/80 mt-1 block">Past deadline</span>
                </div>

                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">Unassigned</span>
                    <UserX className="text-amber-400" size={18} />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-amber-400">{data.unassignedCount}</p>
                  <span className="text-xs text-slate-500 mt-1 block">Needs allocation</span>
                </div>

                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">Progress</span>
                    <TrendingUp className="text-purple-400" size={18} />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-purple-400">{data.completionRate}%</p>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-purple-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${data.completionRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Status & Priority Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200">Status Distribution</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Workflow status allocation of tasks</p>
                    </div>
                  </div>
                  <StatusDistributionChart data={data.statusDistribution} />
                </div>

                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200">Priority Breakdown</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Urgency and importance tiers</p>
                    </div>
                  </div>
                  <PriorityDistributionChart data={data.priorityDistribution} />
                </div>
              </div>

              {/* Workload Allocation & Weekly Velocity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

              {/* Workload Table & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SPRINT VELOCITY & BURNDOWN (ANL-02) */}
      {/* ========================================================================= */}
      {activeTab === "sprints" && (
        <div className="space-y-6">
          {/* Sprint Top Control Bar */}
          <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Select Sprint:</span>
              <select
                value={selectedSprintId}
                onChange={(e) => setSelectedSprintId(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-200 focus:outline-none cursor-pointer"
              >
                {projectSprints.length === 0 ? (
                  <option value="">No sprints created in project</option>
                ) : (
                  projectSprints.map((s) => (
                    <option key={s._id} value={s._id} className="bg-slate-900 text-slate-200">
                      {s.name} ({s.status.toUpperCase()})
                    </option>
                  ))
                )}
              </select>

              {burndownData && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    burndownData.sprintStatus === "active"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : burndownData.sprintStatus === "completed"
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {burndownData.sprintStatus}
                </span>
              )}
            </div>

            {/* Measurement Unit Badge */}
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Scale size={14} className="text-indigo-400" />
              <span>
                Measuring velocity in: <strong className="text-indigo-300 font-semibold">{unitLabel}</strong>
              </span>
            </div>
          </div>

          {sprintLoading && (
            <div className="flex flex-col items-center justify-center p-16">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-sm text-slate-400">Computing sprint velocity and burndown timeline...</p>
            </div>
          )}

          {sprintError && !sprintLoading && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-3">
              <AlertTriangle size={20} />
              <span>{sprintError}</span>
            </div>
          )}

          {/* Empty Sprints Guard */}
          {!sprintLoading && !sprintError && projectSprints.length === 0 && (
            <div className="text-center p-16 border border-slate-800 rounded-2xl bg-slate-900/40">
              <Flame className="mx-auto text-amber-500 mb-3" size={48} />
              <h3 className="text-lg font-semibold text-slate-200">No Sprints Found</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                No sprints have been created for this project yet. Start a sprint to track burndown and team velocity.
              </p>
              <button
                onClick={() => navigate(`/kanban/${selectedProjectId}`)}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition"
              >
                Go to Backlog & Sprints
              </button>
            </div>
          )}

          {/* Sprint Analytics Content */}
          {!sprintLoading && !sprintError && projectSprints.length > 0 && (
            <>
              {/* Sprint Summary KPI Cards */}
              {burndownData && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Committed Work */}
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-medium uppercase tracking-wider">Committed</span>
                      <Target className="text-indigo-400" size={18} />
                    </div>
                    <p className="text-2xl font-bold mt-2 text-slate-100">
                      {burndownData.totalCommittedWork}
                      <span className="text-xs font-normal text-slate-400 ml-1">{unitLabel.slice(0, 1)}</span>
                    </p>
                    <span className="text-xs text-slate-500 mt-1 block">
                      {burndownData.taskStats?.total || 0} tasks
                    </span>
                  </div>

                  {/* Completed Work (Velocity) */}
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
                      <CheckCircle className="text-emerald-400" size={18} />
                    </div>
                    <p className="text-2xl font-bold mt-2 text-emerald-400">
                      {burndownData.totalCompletedWork}
                      <span className="text-xs font-normal text-emerald-500/80 ml-1">{unitLabel.slice(0, 1)}</span>
                    </p>
                    <span className="text-xs text-slate-500 mt-1 block">
                      {burndownData.taskStats?.completed || 0} completed
                    </span>
                  </div>

                  {/* Remaining Work */}
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-medium uppercase tracking-wider">Remaining</span>
                      <Clock className="text-blue-400" size={18} />
                    </div>
                    <p className="text-2xl font-bold mt-2 text-blue-400">
                      {burndownData.totalRemainingWork}
                      <span className="text-xs font-normal text-blue-500/80 ml-1">{unitLabel.slice(0, 1)}</span>
                    </p>
                    <span className="text-xs text-slate-500 mt-1 block">To complete</span>
                  </div>

                  {/* Scope Added */}
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-medium uppercase tracking-wider">Scope Added</span>
                      <ArrowUpRight className="text-amber-400" size={18} />
                    </div>
                    <p className="text-2xl font-bold mt-2 text-amber-400">
                      +{burndownData.scopeChanges?.addedWork || 0}
                      <span className="text-xs font-normal text-amber-500/80 ml-1">{unitLabel.slice(0, 1)}</span>
                    </p>
                    <span className="text-xs text-slate-500 mt-1 block">
                      {burndownData.scopeChanges?.addedTasks || 0} tasks added mid-sprint
                    </span>
                  </div>

                  {/* Carryover */}
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-medium uppercase tracking-wider">Carryover</span>
                      <AlertTriangle className="text-rose-400" size={18} />
                    </div>
                    <p className="text-2xl font-bold mt-2 text-rose-400">
                      {burndownData.scopeChanges?.carryoverWork || 0}
                      <span className="text-xs font-normal text-rose-500/80 ml-1">{unitLabel.slice(0, 1)}</span>
                    </p>
                    <span className="text-xs text-slate-500 mt-1 block">
                      {burndownData.taskStats?.carryover || 0} unfinished tasks
                    </span>
                  </div>

                  {/* Average Velocity */}
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-medium uppercase tracking-wider">Avg Velocity</span>
                      <Zap className="text-purple-400" size={18} />
                    </div>
                    <p className="text-2xl font-bold mt-2 text-purple-400">
                      {velocityData?.averageVelocity || 0}
                      <span className="text-xs font-normal text-purple-500/80 ml-1">{unitLabel.slice(0, 1)}</span>
                    </p>
                    <span className="text-xs text-slate-500 mt-1 block">Past iterations</span>
                  </div>
                </div>
              )}

              {/* Main Charts: Burndown & Velocity Comparison */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sprint Burndown Line Chart */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <Flame size={18} className="text-amber-400" />
                        Sprint Burndown
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Ideal guideline vs actual remaining work in {unitLabel}
                      </p>
                    </div>
                  </div>
                  <SprintBurndownChart
                    timeline={burndownData?.burndownTimeline || []}
                    unitLabel={unitLabel}
                  />
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
                    <span>
                      Start:{" "}
                      {burndownData?.startDate
                        ? new Date(burndownData.startDate).toLocaleDateString()
                        : "Not specified"}
                    </span>
                    <span>
                      End:{" "}
                      {burndownData?.endDate
                        ? new Date(burndownData.endDate).toLocaleDateString()
                        : "Not specified"}
                    </span>
                  </div>
                </div>

                {/* Historical Sprint Velocity Bar Chart */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-400" />
                        Sprint Velocity Comparison
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Committed vs completed work across sprints ({unitLabel})
                      </p>
                    </div>
                  </div>
                  <SprintVelocityChart
                    data={velocityData?.sprints || []}
                    unitLabel={unitLabel}
                  />
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
                    <span>Total Sprints: {velocityData?.totalSprintsAnalyzed || 0}</span>
                    <span>
                      Team Average Velocity:{" "}
                      <strong className="text-emerald-400 font-semibold">
                        {velocityData?.averageVelocity || 0} {unitLabel}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Historical Sprint Velocity Table */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                <h3 className="font-semibold text-slate-200 mb-3">Historical Sprint Performance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 font-medium">Sprint</th>
                        <th className="pb-3 font-medium text-center">Status</th>
                        <th className="pb-3 font-medium text-center">Tasks</th>
                        <th className="pb-3 font-medium text-center">Committed ({unitLabel})</th>
                        <th className="pb-3 font-medium text-center">Completed ({unitLabel})</th>
                        <th className="pb-3 font-medium text-right">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {velocityData?.sprints && velocityData.sprints.length > 0 ? (
                        velocityData.sprints.map((s) => {
                          const rate = s.committed > 0 ? Math.round((s.completed / s.committed) * 100) : 0;
                          return (
                            <tr key={s.sprintId} className="hover:bg-slate-800/20">
                              <td className="py-3 font-medium text-slate-200">{s.sprintName}</td>
                              <td className="py-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    s.status === "active"
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : s.status === "completed"
                                      ? "bg-blue-500/10 text-blue-400"
                                      : "bg-slate-800 text-slate-400"
                                  }`}
                                >
                                  {s.status}
                                </span>
                              </td>
                              <td className="py-3 text-center text-slate-400">{s.taskCount}</td>
                              <td className="py-3 text-center text-slate-300 font-semibold">{s.committed}</td>
                              <td className="py-3 text-center text-emerald-400 font-semibold">{s.completed}</td>
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
                            No historical sprint data recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

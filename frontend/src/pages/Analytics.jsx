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
  Scale,
  ShieldAlert,
  Sliders,
  CheckSquare,
  HelpCircle,
  Briefcase,
} from "lucide-react";
import {
  StatusDistributionChart,
  PriorityDistributionChart,
  WorkloadDistributionChart,
  VelocityChart,
  SprintVelocityChart,
  SprintBurndownChart,
  TeamCapacityComparisonChart,
  MemberTaskStatusBreakdownChart,
} from "../components/AnalyticsCharts";

export default function Analytics() {
  const { projectId: urlProjectId } = useParams();
  const navigate = useNavigate();

  // Navigation tab: 'overview' | 'capacity' | 'sprints'
  const [activeTab, setActiveTab] = useState("overview");

  // Project selection & multi-project support
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || "");

  // Measurement unit: 'estimatedHours' or 'storyPoints'
  const [measurementUnit, setMeasurementUnit] = useState("estimatedHours");

  // Overall analytics data states (ANL-01)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states for Overview
  const [dateRange, setDateRange] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Sprint Velocity & Burndown states (ANL-02)
  const [projectSprints, setProjectSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [velocityData, setVelocityData] = useState(null);
  const [burndownData, setBurndownData] = useState(null);
  const [sprintLoading, setSprintLoading] = useState(false);
  const [sprintError, setSprintError] = useState(null);

  // Team Workload & Capacity Analysis states (ANL-03)
  const [capacityData, setCapacityData] = useState(null);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [capacityError, setCapacityError] = useState(null);
  const [capacitySprintFilter, setCapacitySprintFilter] = useState("all");
  const [capacityMemberFilter, setCapacityMemberFilter] = useState("all");
  const [capacityRangeFilter, setCapacityRangeFilter] = useState("all");
  const [customCapacityStart, setCustomCapacityStart] = useState("");
  const [customCapacityEnd, setCustomCapacityEnd] = useState("");
  const [projectMembersList, setProjectMembersList] = useState([]);

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

  // Fetch project team members for filter dropdowns
  const fetchMembers = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const res = await axiosClient.get(`/projects/${selectedProjectId}/members`);
      setProjectMembersList(res.data || []);
    } catch (err) {
      console.error("Failed to load project members:", err);
    }
  }, [selectedProjectId]);

  // Fetch project analytics (Overview - ANL-01)
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
        setSelectedSprintId((prev) =>
          prev && list.some((s) => s._id === prev) ? prev : active ? active._id : list[0]._id
        );
      } else {
        setSelectedSprintId("");
      }
    } catch (err) {
      console.error("Failed to load project sprints:", err);
    }
  }, [selectedProjectId]);

  // Fetch sprint velocity and burndown (ANL-02)
  const fetchSprintAnalytics = useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      setSprintLoading(true);
      setSprintError(null);

      const velRes = await axiosClient.get(`/analytics/project/${selectedProjectId}/velocity`, {
        params: { unit: measurementUnit },
      });
      setVelocityData(velRes.data);

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

  // Fetch team workload and capacity analysis (ANL-03)
  const fetchCapacityAnalytics = useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      setCapacityLoading(true);
      setCapacityError(null);

      const params = {
        unit: measurementUnit,
        sprintId: capacitySprintFilter,
        memberId: capacityMemberFilter,
        range: capacityRangeFilter,
      };

      if (capacityRangeFilter === "custom") {
        if (customCapacityStart) params.startDate = customCapacityStart;
        if (customCapacityEnd) params.endDate = customCapacityEnd;
      }

      const res = await axiosClient.get(`/analytics/project/${selectedProjectId}/workload-capacity`, {
        params,
      });
      setCapacityData(res.data);
    } catch (err) {
      console.error("Failed to load workload capacity:", err);
      setCapacityError(err.response?.data?.message || "Failed to load team workload capacity.");
    } finally {
      setCapacityLoading(false);
    }
  }, [
    selectedProjectId,
    measurementUnit,
    capacitySprintFilter,
    capacityMemberFilter,
    capacityRangeFilter,
    customCapacityStart,
    customCapacityEnd,
  ]);

  useEffect(() => {
    fetchAnalytics();
    fetchSprints();
    fetchMembers();
  }, [fetchAnalytics, fetchSprints, fetchMembers]);

  useEffect(() => {
    if (activeTab === "sprints") {
      fetchSprintAnalytics();
    } else if (activeTab === "capacity") {
      fetchCapacityAnalytics();
    }
  }, [activeTab, fetchSprintAnalytics, fetchCapacityAnalytics]);

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
            Real-time project velocity, workload distribution, capacity utilization, and burndown metrics.
          </p>
        </div>

        {/* Global Project Selector, Unit Toggle & Refresh */}
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

          {/* Measurement Unit Toggle */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
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

          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchAnalytics();
              if (activeTab === "sprints") fetchSprintAnalytics();
              if (activeTab === "capacity") fetchCapacityAnalytics();
            }}
            disabled={loading || sprintLoading || capacityLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition disabled:opacity-50"
            title="Refresh analytics"
          >
            <RefreshCw
              size={16}
              className={loading || sprintLoading || capacityLoading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Overview vs Team Capacity vs Sprints) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex flex-wrap gap-2">
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
            onClick={() => setActiveTab("capacity")}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition flex items-center gap-2 ${
              activeTab === "capacity"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Users size={16} className="text-blue-400" />
            <span>Team Workload & Capacity</span>
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

        {/* Overview Tab Range Selector */}
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
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PROJECT OVERVIEW (ANL-01) */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <>
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
            </>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAM WORKLOAD & CAPACITY ANALYSIS (ANL-03) */}
      {/* ========================================================================= */}
      {activeTab === "capacity" && (
        <div className="space-y-6">
          {/* Multi-Filter Bar: Sprint, Member, Date Range */}
          <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Sprint Filter */}
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
                <Flame size={15} className="text-amber-400" />
                <span className="text-xs text-slate-400">Sprint:</span>
                <select
                  value={capacitySprintFilter}
                  onChange={(e) => setCapacitySprintFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-slate-200">All Project Sprints</option>
                  {projectSprints.map((s) => (
                    <option key={s._id} value={s._id} className="bg-slate-900 text-slate-200">
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Member Filter */}
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
                <Users size={15} className="text-indigo-400" />
                <span className="text-xs text-slate-400">Member:</span>
                <select
                  value={capacityMemberFilter}
                  onChange={(e) => setCapacityMemberFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-slate-200">All Team Members</option>
                  {projectMembersList.map((m) => (
                    <option key={m._id} value={m._id} className="bg-slate-900 text-slate-200">
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
                <Calendar size={15} className="text-slate-400" />
                <span className="text-xs text-slate-400">Date:</span>
                <select
                  value={capacityRangeFilter}
                  onChange={(e) => setCapacityRangeFilter(e.target.value)}
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
            </div>

            {/* Overload Alert Badge */}
            {capacityData?.isTeamOverloaded && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold">
                <ShieldAlert size={14} />
                <span>Team Over-Allocated!</span>
              </div>
            )}
          </div>

          {/* Custom Date Pickers */}
          {capacityRangeFilter === "custom" && (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-indigo-400" />
                <span className="text-slate-400">From:</span>
                <input
                  type="date"
                  value={customCapacityStart}
                  onChange={(e) => setCustomCapacityStart(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-sm focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">To:</span>
                <input
                  type="date"
                  value={customCapacityEnd}
                  onChange={(e) => setCustomCapacityEnd(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-sm focus:outline-none"
                />
              </div>
              <button
                onClick={fetchCapacityAnalytics}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
              >
                Apply Range
              </button>
            </div>
          )}

          {capacityLoading && (
            <div className="flex flex-col items-center justify-center p-16">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-sm text-slate-400">Analyzing team capacity & member allocation...</p>
            </div>
          )}

          {capacityError && !capacityLoading && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-3">
              <AlertTriangle size={20} />
              <span>{capacityError}</span>
            </div>
          )}

          {!capacityLoading && !capacityError && capacityData && (
            <>
              {/* Capacity KPI Highlights */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Total Capacity */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">Total Capacity</span>
                    <Briefcase className="text-indigo-400" size={18} />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-slate-100">
                    {capacityData.totalCapacity}
                    <span className="text-xs font-normal text-slate-400 ml-1">{unitLabel.slice(0, 1)}</span>
                  </p>
                  <span className="text-xs text-slate-500 mt-1 block">Configured availability</span>
                </div>

                {/* Committed Work */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">Committed Work</span>
                    <Target className="text-blue-400" size={18} />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-blue-400">
                    {capacityData.totalCommittedWork}
                    <span className="text-xs font-normal text-blue-500/80 ml-1">{unitLabel.slice(0, 1)}</span>
                  </p>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {capacityData.totalTasks} total tasks
                  </span>
                </div>

                {/* Team Utilization */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">Utilization</span>
                    <TrendingUp className={capacityData.isTeamOverloaded ? "text-red-400" : "text-emerald-400"} size={18} />
                  </div>
                  <p className={`text-2xl font-bold mt-2 ${capacityData.isTeamOverloaded ? "text-red-400" : "text-emerald-400"}`}>
                    {capacityData.teamUtilizationRate}%
                  </p>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        capacityData.isTeamOverloaded ? "bg-red-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, capacityData.teamUtilizationRate)}%` }}
                    />
                  </div>
                </div>

                {/* Over-Allocated Members */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">Over-Allocated</span>
                    <ShieldAlert className="text-rose-400" size={18} />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-rose-400">
                    {capacityData.workloadBalance?.overAllocatedCount || 0}
                  </p>
                  <span className="text-xs text-slate-500 mt-1 block">Members above 100%</span>
                </div>

                {/* Unassigned Work */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">Unassigned Work</span>
                    <UserX className="text-amber-400" size={18} />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-amber-400">
                    {capacityData.unassignedWork?.estimatedWork || 0}
                    <span className="text-xs font-normal text-amber-500/80 ml-1">{unitLabel.slice(0, 1)}</span>
                  </p>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {capacityData.unassignedWork?.taskCount || 0} tasks unassigned
                  </span>
                </div>

                {/* Unestimated Tasks */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium uppercase tracking-wider">Unestimated</span>
                    <HelpCircle className="text-purple-400" size={18} />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-purple-400">
                    {capacityData.unassignedWork?.unestimatedTaskCount || 0}
                  </p>
                  <span className="text-xs text-slate-500 mt-1 block">Tasks without estimate</span>
                </div>
              </div>

              {/* Charts Row: Capacity vs Committed & Task Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Available Capacity vs Committed Work Chart */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <Scale size={18} className="text-indigo-400" />
                        Capacity vs Committed Work
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Configured capacity vs assigned workload per member ({unitLabel})
                      </p>
                    </div>
                  </div>
                  <TeamCapacityComparisonChart
                    members={capacityData.members || []}
                    unitLabel={unitLabel}
                  />
                </div>

                {/* Member Task Distribution Stacked Bar */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <CheckSquare size={18} className="text-emerald-400" />
                        Task Status Allocation
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Completed, pending, and overdue task count per member
                      </p>
                    </div>
                  </div>
                  <MemberTaskStatusBreakdownChart members={capacityData.members || []} />
                </div>
              </div>

              {/* Comprehensive Team Member Capacity & Workload Table */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-200">Team Member Capacity Breakdown</h3>
                  {capacityData.workloadBalance?.isImbalanced && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Workload Imbalance Detected
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 font-medium">Team Member</th>
                        <th className="pb-3 font-medium text-center">Tasks</th>
                        <th className="pb-3 font-medium text-center">Completed</th>
                        <th className="pb-3 font-medium text-center">Pending</th>
                        <th className="pb-3 font-medium text-center">Overdue</th>
                        <th className="pb-3 font-medium text-center">Unestimated</th>
                        <th className="pb-3 font-medium text-center">Committed ({unitLabel.slice(0, 1)})</th>
                        <th className="pb-3 font-medium text-center">Capacity ({unitLabel.slice(0, 1)})</th>
                        <th className="pb-3 font-medium text-right">Utilization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {capacityData.members && capacityData.members.length > 0 ? (
                        capacityData.members.map((m) => (
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
                            <td className="py-3 text-center text-slate-300 font-semibold">{m.assignedCount}</td>
                            <td className="py-3 text-center text-emerald-400">{m.completedCount}</td>
                            <td className="py-3 text-center text-blue-400">{m.pendingCount}</td>
                            <td className="py-3 text-center text-red-400 font-medium">{m.overdueCount}</td>
                            <td className="py-3 text-center text-purple-400">{m.unestimatedCount}</td>
                            <td className="py-3 text-center text-slate-200 font-bold">{m.committedWork}</td>
                            <td className="py-3 text-center text-slate-400">{m.capacity}</td>
                            <td className="py-3 text-right">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${
                                  m.isOverAllocated
                                    ? "bg-red-500/10 text-red-400 border border-red-500/30"
                                    : m.utilizationRate > 80
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                }`}
                              >
                                {m.utilizationRate}%
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-slate-500">
                            No team members found for this project.
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

      {/* ========================================================================= */}
      {/* TAB 3: SPRINT VELOCITY & BURNDOWN (ANL-02) */}
      {/* ========================================================================= */}
      {activeTab === "sprints" && (
        <div className="space-y-6">
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

          {!sprintLoading && !sprintError && projectSprints.length > 0 && (
            <>
              {burndownData && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

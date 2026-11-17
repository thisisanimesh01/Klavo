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
  Timer,
  RotateCcw,
  Hourglass,
  Gauge,
  HeartPulse,
  Check,
  XCircle,
  FileText,
  Save,
  Trash2,
  PieChart as PieChartIcon,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Share2,
  Download,
  FileSpreadsheet,
  Building,
  Trophy,
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
  TaskCompletionTrendsChart,
  CycleLeadTimeComparisonChart,
  StageBottleneckChart,
  HealthScoreGauge,
  MilestoneProgressChart,
  CustomReportBarChart,
  CustomReportPieChart,
} from "../components/AnalyticsCharts";

export default function Analytics() {
  const { projectId: urlProjectId } = useParams();
  const navigate = useNavigate();

  // Navigation tab: 'overview' | 'health' | 'capacity' | 'cycle_time' | 'sprints' | 'custom_reports'
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

  // Task Completion & Cycle-Time states (ANL-04)
  const [cycleData, setCycleData] = useState(null);
  const [cycleLoading, setCycleLoading] = useState(false);
  const [cycleError, setCycleError] = useState(null);
  const [cycleSprintFilter, setCycleSprintFilter] = useState("all");
  const [cycleMemberFilter, setCycleMemberFilter] = useState("all");
  const [cyclePriorityFilter, setCyclePriorityFilter] = useState("all");
  const [cycleRangeFilter, setCycleRangeFilter] = useState("all");
  const [customCycleStart, setCustomCycleStart] = useState("");
  const [customCycleEnd, setCustomCycleEnd] = useState("");
  const [trendGranularity, setTrendGranularity] = useState("daily"); // 'daily' | 'weekly' | 'monthly'

  // Project Health & Progress Indicators states (ANL-05)
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState(null);

  // Custom Reports states (ANL-06)
  const [reportResult, setReportResult] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [savedReports, setSavedReports] = useState([]);
  const [selectedSavedReportId, setSelectedSavedReportId] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newReportName, setNewReportName] = useState("");
  const [newReportDesc, setNewReportDesc] = useState("");
  const [newReportIsShared, setNewReportIsShared] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);

  // Builder config
  const [reportGroupBy, setReportGroupBy] = useState("status");
  const [reportSortBy, setReportSortBy] = useState("createdAt");
  const [reportSortOrder, setReportSortOrder] = useState("desc");
  const [reportRange, setReportRange] = useState("all");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportDateField, setReportDateField] = useState("createdAt");
  const [reportChartType, setReportChartType] = useState("bar"); // 'bar' | 'pie' | 'table'
  const [reportMetric, setReportMetric] = useState("count"); // 'count' | 'estimatedHours' | 'storyPoints'
  const [reportPage, setReportPage] = useState(1);

  // Export states (ANL-07)
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportSuccess, setExportSuccess] = useState(null);

  // Workspace-wide Analytics states (ANL-08)
  const [workspaceData, setWorkspaceData] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teams, setTeams] = useState([]);
  const [workspaceFilterProjects, setWorkspaceFilterProjects] = useState("all");

  // Load available projects and workspaces (teams)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [projRes, teamsRes] = await Promise.allSettled([
          axiosClient.get("/projects"),
          axiosClient.get("/teams"),
        ]);

        const projectList = projRes.status === "fulfilled" ? projRes.value.data || [] : [];
        setProjects(projectList);

        const teamList = teamsRes.status === "fulfilled" ? teamsRes.value.data || [] : [];
        setTeams(teamList);

        if (!selectedProjectId && projectList.length > 0) {
          setSelectedProjectId(projectList[0]._id);
        }
        if (!selectedTeamId && teamList.length > 0) {
          setSelectedTeamId(teamList[0]._id);
        } else if (!selectedTeamId && projectList.length > 0 && projectList[0].teamId) {
          setSelectedTeamId(projectList[0].teamId);
        }
      } catch (err) {
        console.error("Failed to load user projects and teams:", err);
      }
    };
    fetchInitialData();
  }, [selectedProjectId, selectedTeamId]);

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

  // Fetch task completion & cycle time metrics (ANL-04)
  const fetchCycleTimeAnalytics = useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      setCycleLoading(true);
      setCycleError(null);

      const params = {
        sprintId: cycleSprintFilter,
        memberId: cycleMemberFilter,
        priority: cyclePriorityFilter,
        range: cycleRangeFilter,
      };

      if (cycleRangeFilter === "custom") {
        if (customCycleStart) params.startDate = customCycleStart;
        if (customCycleEnd) params.endDate = customCycleEnd;
      }

      const res = await axiosClient.get(`/analytics/project/${selectedProjectId}/completion-cycle-time`, {
        params,
      });
      setCycleData(res.data);
    } catch (err) {
      console.error("Failed to load completion cycle-time metrics:", err);
      setCycleError(err.response?.data?.message || "Failed to load completion & cycle-time analytics.");
    } finally {
      setCycleLoading(false);
    }
  }, [
    selectedProjectId,
    cycleSprintFilter,
    cycleMemberFilter,
    cyclePriorityFilter,
    cycleRangeFilter,
    customCycleStart,
    customCycleEnd,
  ]);

  // Fetch project health & progress indicators (ANL-05)
  const fetchHealthAnalytics = useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      setHealthLoading(true);
      setHealthError(null);

      const res = await axiosClient.get(`/analytics/project/${selectedProjectId}/health`);
      setHealthData(res.data);
    } catch (err) {
      console.error("Failed to load project health:", err);
      setHealthError(err.response?.data?.message || "Failed to load project health indicators.");
    } finally {
      setHealthLoading(false);
    }
  }, [selectedProjectId]);

  // Fetch saved reports list (ANL-06)
  const fetchSavedReports = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const res = await axiosClient.get(`/analytics/project/${selectedProjectId}/saved-reports`);
      setSavedReports(res.data || []);
    } catch (err) {
      console.error("Failed to load saved reports:", err);
    }
  }, [selectedProjectId]);

  // Run Custom Report execution (ANL-06)
  const runCustomReport = useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      setReportLoading(true);
      setReportError(null);

      const payload = {
        groupBy: reportGroupBy,
        sortBy: reportSortBy,
        sortOrder: reportSortOrder,
        range: reportRange,
        dateField: reportDateField,
        page: reportPage,
        limit: 50,
      };

      if (reportRange === "custom") {
        if (reportStartDate) payload.startDate = reportStartDate;
        if (reportEndDate) payload.endDate = reportEndDate;
      }

      const res = await axiosClient.post(
        `/analytics/project/${selectedProjectId}/custom-report`,
        payload
      );
      setReportResult(res.data);
    } catch (err) {
      console.error("Failed to execute custom report:", err);
      setReportError(err.response?.data?.message || "Failed to generate report.");
    } finally {
      setReportLoading(false);
    }
  }, [
    selectedProjectId,
    reportGroupBy,
    reportSortBy,
    reportSortOrder,
    reportRange,
    reportDateField,
    reportStartDate,
    reportEndDate,
    reportPage,
  ]);

  // Save new report configuration
  const handleSaveReport = async (e) => {
    e.preventDefault();
    if (!newReportName.trim()) return;

    try {
      setReportSaving(true);
      const payload = {
        name: newReportName.trim(),
        description: newReportDesc.trim(),
        isShared: newReportIsShared,
        groupBy: reportGroupBy,
        sortBy: reportSortBy,
        sortOrder: reportSortOrder,
        chartType: reportChartType,
        filters: {
          range: reportRange,
          startDate: reportRange === "custom" && reportStartDate ? reportStartDate : null,
          endDate: reportRange === "custom" && reportEndDate ? reportEndDate : null,
          dateField: reportDateField,
        },
      };

      const res = await axiosClient.post(
        `/analytics/project/${selectedProjectId}/saved-reports`,
        payload
      );
      setSavedReports((prev) => [res.data, ...prev]);
      setSelectedSavedReportId(res.data._id);
      setSaveModalOpen(false);
      setNewReportName("");
      setNewReportDesc("");
    } catch (err) {
      console.error("Failed to save report configuration:", err);
      alert(err.response?.data?.message || "Failed to save report.");
    } finally {
      setReportSaving(false);
    }
  };

  // Load a saved report configuration
  const handleSelectSavedReport = (savedReportId) => {
    setSelectedSavedReportId(savedReportId);
    if (!savedReportId) return;

    const saved = savedReports.find((r) => r._id === savedReportId);
    if (saved) {
      if (saved.groupBy) setReportGroupBy(saved.groupBy);
      if (saved.sortBy) setReportSortBy(saved.sortBy);
      if (saved.sortOrder) setReportSortOrder(saved.sortOrder);
      if (saved.chartType) setReportChartType(saved.chartType);
      if (saved.filters) {
        if (saved.filters.range) setReportRange(saved.filters.range);
        if (saved.filters.dateField) setReportDateField(saved.filters.dateField);
        if (saved.filters.startDate) setReportStartDate(saved.filters.startDate.slice(0, 10));
        if (saved.filters.endDate) setReportEndDate(saved.filters.endDate.slice(0, 10));
      }
      setReportPage(1);
    }
  };

  // Delete saved report configuration
  const handleDeleteSavedReport = async (reportId) => {
    if (!window.confirm("Are you sure you want to delete this saved report?")) return;
    try {
      await axiosClient.delete(`/analytics/saved-reports/${reportId}`);
      setSavedReports((prev) => prev.filter((r) => r._id !== reportId));
      if (selectedSavedReportId === reportId) {
        setSelectedSavedReportId("");
      }
    } catch (err) {
      console.error("Failed to delete saved report:", err);
      alert(err.response?.data?.message || "Failed to delete saved report.");
    }
  };

  // Export report in CSV or PDF format (ANL-07)
  const handleExportReport = async (format = "csv") => {
    if (!selectedProjectId) return;
    try {
      setExportLoading(true);
      setExportError(null);
      setExportSuccess(null);

      const activeProjectObj = projects.find((p) => p._id === selectedProjectId);
      const projName = activeProjectObj ? activeProjectObj.name : "Project";

      let title = `${projName} Analytics Report`;
      if (activeTab === "sprints") {
        title = `${projName} Sprint Velocity & Burndown Report`;
      } else if (activeTab === "capacity") {
        title = `${projName} Team Workload & Capacity Report`;
      } else if (activeTab === "cycle_time") {
        title = `${projName} Cycle & Lead Time Report`;
      } else if (activeTab === "health") {
        title = `${projName} Project Health & Progress Report`;
      } else if (activeTab === "custom_reports") {
        const savedMatch = savedReports.find((r) => r._id === selectedSavedReportId);
        title = savedMatch ? savedMatch.name : `${projName} Custom Report`;
      } else if (activeTab === "workspace") {
        const teamObj = teams.find((t) => t._id === selectedTeamId);
        title = `${teamObj ? teamObj.name : "Workspace"} Analytics & Ranking Report`;
      }

      let res;
      if (activeTab === "workspace") {
        const wsPayload = {
          format,
          reportTitle: title,
          range: dateRange,
          projectIds: workspaceFilterProjects === "all" ? undefined : workspaceFilterProjects,
        };
        if (dateRange === "custom") {
          if (customStartDate) wsPayload.startDate = customStartDate;
          if (customEndDate) wsPayload.endDate = customEndDate;
        }
        res = await axiosClient.post(
          `/analytics/workspace/${selectedTeamId}/export`,
          wsPayload,
          { responseType: "blob" }
        );
      } else {
        const payload = {
          format,
          reportTitle: title,
          savedReportId: activeTab === "custom_reports" && selectedSavedReportId ? selectedSavedReportId : undefined,
          range: activeTab === "custom_reports" ? reportRange : dateRange,
          dateField: activeTab === "custom_reports" ? reportDateField : "createdAt",
          groupBy: activeTab === "custom_reports" ? reportGroupBy : "status",
          sortBy: activeTab === "custom_reports" ? reportSortBy : "createdAt",
          sortOrder: activeTab === "custom_reports" ? reportSortOrder : "desc",
        };

        if (payload.range === "custom") {
          if (activeTab === "custom_reports") {
            if (reportStartDate) payload.startDate = reportStartDate;
            if (reportEndDate) payload.endDate = reportEndDate;
          } else {
            if (customStartDate) payload.startDate = customStartDate;
            if (customEndDate) payload.endDate = customEndDate;
          }
        }

        res = await axiosClient.post(
          `/analytics/project/${selectedProjectId}/export`,
          payload,
          { responseType: "blob" }
        );
      }

      // Extract filename from Content-Disposition header if available
      const contentDisposition = res.headers["content-disposition"] || "";
      let filename = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date().toISOString().slice(0, 10)}.${format}`;
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }

      // Trigger client-side browser download
      const mimeType = format === "pdf" ? "application/pdf" : "text/csv;charset=utf-8;";
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setExportSuccess(`Successfully generated ${format.toUpperCase()} export (${filename}).`);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err) {
      console.error(`Failed to export report as ${format}:`, err);
      setExportError(err.response?.data?.message || `Failed to export report as ${format.toUpperCase()}. Please try again.`);
      setTimeout(() => setExportError(null), 6000);
    } finally {
      setExportLoading(false);
    }
  };

  // Fetch workspace analytics (ANL-08)
  const fetchWorkspaceAnalytics = useCallback(async () => {
    if (!selectedTeamId) return;
    try {
      setWorkspaceLoading(true);
      setWorkspaceError(null);

      const params = new URLSearchParams();
      params.append("range", dateRange);
      if (dateRange === "custom") {
        if (customStartDate) params.append("startDate", customStartDate);
        if (customEndDate) params.append("endDate", customEndDate);
      }
      if (workspaceFilterProjects !== "all") {
        params.append("projectIds", workspaceFilterProjects);
      }

      const res = await axiosClient.get(`/analytics/workspace/${selectedTeamId}?${params.toString()}`);
      setWorkspaceData(res.data);
    } catch (err) {
      console.error("Failed to load workspace analytics:", err);
      setWorkspaceError(err.response?.data?.message || "Failed to load workspace analytics.");
    } finally {
      setWorkspaceLoading(false);
    }
  }, [selectedTeamId, dateRange, customStartDate, customEndDate, workspaceFilterProjects]);

  useEffect(() => {
    fetchAnalytics();
    fetchSprints();
    fetchMembers();
    fetchSavedReports();
  }, [fetchAnalytics, fetchSprints, fetchMembers, fetchSavedReports]);

  useEffect(() => {
    if (activeTab === "sprints") {
      fetchSprintAnalytics();
    } else if (activeTab === "capacity") {
      fetchCapacityAnalytics();
    } else if (activeTab === "cycle_time") {
      fetchCycleTimeAnalytics();
    } else if (activeTab === "health") {
      fetchHealthAnalytics();
    } else if (activeTab === "custom_reports") {
      runCustomReport();
    } else if (activeTab === "workspace") {
      fetchWorkspaceAnalytics();
    }
  }, [
    activeTab,
    fetchSprintAnalytics,
    fetchCapacityAnalytics,
    fetchCycleTimeAnalytics,
    fetchHealthAnalytics,
    runCustomReport,
    fetchWorkspaceAnalytics,
  ]);

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

        {/* Global Project/Workspace Selector, Unit Toggle & Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Workspace (Team) Selector if in Workspace tab */}
          {activeTab === "workspace" ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
              <Building size={16} className="text-cyan-400" />
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer"
              >
                {teams.length === 0 ? (
                  <option value="">No workspaces available</option>
                ) : (
                  teams.map((t) => (
                    <option key={t._id} value={t._id} className="bg-slate-900 text-slate-200">
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : (
            /* Project Selector */
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
          )}

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
              if (activeTab === "cycle_time") fetchCycleTimeAnalytics();
              if (activeTab === "health") fetchHealthAnalytics();
              if (activeTab === "custom_reports") runCustomReport();
            }}
            disabled={loading || sprintLoading || capacityLoading || cycleLoading || healthLoading || reportLoading || exportLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition disabled:opacity-50"
            title="Refresh analytics"
          >
            <RefreshCw
              size={16}
              className={loading || sprintLoading || capacityLoading || cycleLoading || healthLoading || reportLoading ? "animate-spin" : ""}
            />
          </button>

          {/* Export Actions (CSV & PDF) */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => handleExportReport("csv")}
              disabled={exportLoading}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 font-medium transition flex items-center gap-1 disabled:opacity-50"
              title="Export report as RFC 4180 CSV"
            >
              <FileSpreadsheet size={13} />
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleExportReport("pdf")}
              disabled={exportLoading}
              className="px-2.5 py-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 font-medium transition flex items-center gap-1 disabled:opacity-50"
              title="Export report as formatted PDF document"
            >
              <Download size={13} />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Overview vs Health vs Capacity vs Cycle Time vs Sprints vs Custom Reports) */}
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
            onClick={() => setActiveTab("health")}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition flex items-center gap-2 ${
              activeTab === "health"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <HeartPulse size={16} className="text-emerald-400" />
            <span>Project Health & Progress</span>
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
            onClick={() => setActiveTab("cycle_time")}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition flex items-center gap-2 ${
              activeTab === "cycle_time"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Timer size={16} className="text-purple-400" />
            <span>Completion & Cycle Time</span>
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

          <button
            onClick={() => setActiveTab("custom_reports")}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition flex items-center gap-2 ${
              activeTab === "custom_reports"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <FileText size={16} className="text-cyan-400" />
            <span>Custom Reports & Filters</span>
          </button>

          <button
            onClick={() => setActiveTab("workspace")}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition flex items-center gap-2 ${
              activeTab === "workspace"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Building size={16} className="text-pink-400" />
            <span>Workspace Analytics</span>
          </button>
        </div>

        {/* Overview & Workspace Tab Range Selector */}
        {(activeTab === "overview" || activeTab === "workspace") && (
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

      {/* Export Notifications (Success / Error / Loading Banner) */}
      {exportLoading && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
          <RefreshCw size={14} className="animate-spin" />
          <span>Generating and downloading export document... Please wait.</span>
        </div>
      )}
      {exportSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <Check size={14} className="text-emerald-400" />
          <span>{exportSuccess}</span>
        </div>
      )}
      {exportError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400" />
          <span>{exportError}</span>
        </div>
      )}

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
      {/* TAB 1.5: PROJECT HEALTH & PROGRESS INDICATORS (ANL-05)                    */}
      {/* ========================================================================= */}
      {activeTab === "health" && (
        <div className="space-y-6">
          {healthLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="animate-spin text-emerald-400" size={24} />
              <p className="text-sm text-slate-400">Calculating comprehensive project health indicators...</p>
            </div>
          ) : healthError ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm">
              <AlertTriangle size={18} />
              <span>{healthError}</span>
            </div>
          ) : !healthData ? (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              <HeartPulse size={32} className="mx-auto mb-2 opacity-50 text-emerald-400" />
              <p>No health telemetry available for this project.</p>
            </div>
          ) : (
            <>
              {/* Top Banner: Health Score Radial Gauge & Executive Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm items-center">
                <div className="flex justify-center border-b md:border-b-0 md:border-r border-slate-800 pb-4 md:pb-0 md:pr-6">
                  <HealthScoreGauge
                    score={healthData.healthScore}
                    state={healthData.healthState}
                    color={healthData.statusColor}
                  />
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                        Executive Health Assessment
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-100 mt-1">
                      {healthData.projectName} is currently{" "}
                      <span style={{ color: healthData.statusColor }}>
                        {healthData.healthState}
                      </span>
                    </h2>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                      {healthData.summary}
                    </p>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Overdue Tasks</span>
                      <span className={`text-base font-bold ${healthData.metrics.overdueTasksCount > 0 ? "text-red-400" : "text-slate-200"}`}>
                        {healthData.metrics.overdueTasksCount} ({healthData.metrics.overdueRate}%)
                      </span>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Blocked Tasks</span>
                      <span className={`text-base font-bold ${healthData.metrics.blockedTasksCount > 0 ? "text-amber-400" : "text-slate-200"}`}>
                        {healthData.metrics.blockedTasksCount} ({healthData.metrics.blockedRate}%)
                      </span>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Milestones Slipped</span>
                      <span className={`text-base font-bold ${healthData.metrics.overdueMilestonesCount > 0 ? "text-red-400" : "text-slate-200"}`}>
                        {healthData.metrics.overdueMilestonesCount}
                      </span>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Overloaded Devs</span>
                      <span className={`text-base font-bold ${healthData.metrics.overAllocatedMembersCount > 0 ? "text-amber-400" : "text-slate-200"}`}>
                        {healthData.metrics.overAllocatedMembersCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actionable Risk Alerts */}
              {healthData.alerts && healthData.alerts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 px-1">
                    Risk Alerts & Recommended Actions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {healthData.alerts.map((alert, i) => (
                      <div
                        key={`alert-${i}`}
                        className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                          alert.type === "critical"
                            ? "bg-red-500/10 border-red-500/20 text-red-300"
                            : alert.type === "warning"
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                            : alert.type === "success"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                            : "bg-slate-800/40 border-slate-700 text-slate-300"
                        }`}
                      >
                        {alert.type === "critical" ? (
                          <ShieldAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
                        ) : alert.type === "warning" ? (
                          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        ) : alert.type === "success" ? (
                          <CheckCircle size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <HelpCircle size={18} className="text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <strong className="font-semibold block">{alert.title}</strong>
                          <span className="text-xs opacity-90 block mt-0.5 leading-relaxed">
                            {alert.message}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Factors Attribution Breakdown Cards */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                      <Scale size={18} className="text-indigo-400" />
                      Score Attribution Factors
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Transparent accounting of positive signals and penalty point deductions (Base = 100)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {healthData.factors?.map((f, i) => (
                    <div
                      key={`factor-${i}`}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">{f.name}</span>
                          {f.deduction > 0 ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                              -{f.deduction} pts
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Nominal
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                          {f.description}
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Category: {f.category}</span>
                        <span className="font-semibold text-slate-300">{f.metricValue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Milestone Progress against Target Dates */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                      <Target size={18} className="text-indigo-400" />
                      Milestone Progress & Target Dates
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Progress toward milestone delivery targets and slippage tracking
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <MilestoneProgressChart milestones={healthData.milestoneProgress || []} />
                  </div>

                  {/* Milestone Detailed Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                          <th className="pb-2">Milestone</th>
                          <th className="pb-2 text-center">Due Date</th>
                          <th className="pb-2 text-right">Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {healthData.milestoneProgress && healthData.milestoneProgress.length > 0 ? (
                          healthData.milestoneProgress.map((m) => (
                            <tr key={m.id} className="hover:bg-slate-800/20">
                              <td className="py-2.5">
                                <span className="font-medium text-slate-200 block truncate max-w-[140px]">
                                  {m.name}
                                </span>
                                {m.isOverdue && (
                                  <span className="text-[10px] text-red-400 font-semibold uppercase">
                                    Overdue
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 text-center text-slate-400">
                                {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : "—"}
                              </td>
                              <td className="py-2.5 text-right font-bold text-slate-100">
                                {m.completionRate}%
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="py-4 text-center text-slate-500">
                              No milestones defined
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
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
      {/* TAB 3: TASK COMPLETION & CYCLE-TIME METRICS (ANL-04)                       */}
      {/* ========================================================================= */}
      {activeTab === "cycle_time" && (
        <div className="space-y-6">
          {/* Cycle Time Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Timer size={18} className="text-purple-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                Task Completion, Cycle & Lead Time Analysis
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Sprint Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400">Sprint:</span>
                <select
                  value={cycleSprintFilter}
                  onChange={(e) => setCycleSprintFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Sprints</option>
                  {projectSprints.map((s) => (
                    <option key={s._id} value={s._id} className="bg-slate-900">
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Member Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400">Assignee:</span>
                <select
                  value={cycleMemberFilter}
                  onChange={(e) => setCycleMemberFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Members</option>
                  {projectMembersList.map((m) => (
                    <option key={m._id} value={m._id} className="bg-slate-900">
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400">Priority:</span>
                <select
                  value={cyclePriorityFilter}
                  onChange={(e) => setCyclePriorityFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Priorities</option>
                  <option value="urgent" className="bg-slate-900">Urgent</option>
                  <option value="critical" className="bg-slate-900">Critical</option>
                  <option value="high" className="bg-slate-900">High</option>
                  <option value="medium" className="bg-slate-900">Medium</option>
                  <option value="low" className="bg-slate-900">Low</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400">Period:</span>
                <select
                  value={cycleRangeFilter}
                  onChange={(e) => setCycleRangeFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Time</option>
                  <option value="today" className="bg-slate-900">Today</option>
                  <option value="this_week" className="bg-slate-900">This Week</option>
                  <option value="this_month" className="bg-slate-900">This Month</option>
                  <option value="last_30_days" className="bg-slate-900">Last 30 Days</option>
                  <option value="custom" className="bg-slate-900">Custom</option>
                </select>
              </div>

              {/* Custom Date Pickers */}
              {cycleRangeFilter === "custom" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={customCycleStart}
                    onChange={(e) => setCustomCycleStart(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                  />
                  <span className="text-slate-500 text-xs">to</span>
                  <input
                    type="date"
                    value={customCycleEnd}
                    onChange={(e) => setCustomCycleEnd(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Loading / Error states */}
          {cycleLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="animate-spin text-purple-400" size={24} />
              <p className="text-sm text-slate-400">Computing task completion & cycle-time metrics...</p>
            </div>
          ) : cycleError ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm">
              <AlertTriangle size={18} />
              <span>{cycleError}</span>
            </div>
          ) : !cycleData ? (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              <Timer size={32} className="mx-auto mb-2 opacity-50 text-purple-400" />
              <p>No completion or cycle time metrics found for this filter combination.</p>
            </div>
          ) : (
            <>
              {/* Statistical KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {/* Avg Cycle Time */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Avg Cycle Time</span>
                    <Hourglass size={16} className="text-purple-400" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xl sm:text-2xl font-bold text-slate-100">
                      {cycleData.cycleTime.average !== null ? `${cycleData.cycleTime.average}h` : "—"}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Start → Completion</span>
                  </div>
                </div>

                {/* Avg Lead Time */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Avg Lead Time</span>
                    <Timer size={16} className="text-pink-400" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xl sm:text-2xl font-bold text-slate-100">
                      {cycleData.leadTime.average !== null ? `${cycleData.leadTime.average}h` : "—"}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Created → Completion</span>
                  </div>
                </div>

                {/* 85th Percentile Lead Time */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">85th %ile Lead</span>
                    <Gauge size={16} className="text-indigo-400" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xl sm:text-2xl font-bold text-slate-100">
                      {cycleData.leadTime.p85 !== null ? `${cycleData.leadTime.p85}h` : "—"}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Service level (85% tasks)</span>
                  </div>
                </div>

                {/* Completion Rate */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Completion Rate</span>
                    <CheckCircle size={16} className="text-emerald-400" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                      {cycleData.summary.completionRate}%
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {cycleData.summary.completedTasks} / {cycleData.summary.totalTasks} tasks
                    </span>
                  </div>
                </div>

                {/* On-Time Completion */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">On-Time Rate</span>
                    <Clock size={16} className="text-blue-400" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xl sm:text-2xl font-bold text-slate-100">
                      {cycleData.summary.onTimeCompletionRate !== null
                        ? `${cycleData.summary.onTimeCompletionRate}%`
                        : "—"}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {cycleData.summary.onTimeCompletedCount} on time, {cycleData.summary.overdueCompletedCount} overdue
                    </span>
                  </div>
                </div>

                {/* Reopened Tasks */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Reopened Tasks</span>
                    <RotateCcw size={16} className={cycleData.summary.reopenedCount > 0 ? "text-amber-400" : "text-slate-400"} />
                  </div>
                  <div className="mt-2">
                    <div className={`text-xl sm:text-2xl font-bold ${cycleData.summary.reopenedCount > 0 ? "text-amber-400" : "text-slate-100"}`}>
                      {cycleData.summary.reopenedCount}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {cycleData.summary.reopenedRate}% reopen rate
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Limitation Notice when legacy tasks lack timestamps */}
              {!cycleData.summary.hasHistoricalCycleData && (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
                  <HelpCircle size={18} className="text-indigo-400 shrink-0" />
                  <span>
                    <strong>Notice:</strong> Completed tasks without explicit start timestamps are omitted from cycle time averages rather than inferred from updated times, preventing fabricated velocity data.
                  </span>
                </div>
              )}

              {/* Completion Trends & Distribution Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Completion Trends Chart */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-400" />
                        Task Completion Trends
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Volume of completed tasks over time based on actual completion dates
                      </p>
                    </div>

                    {/* Granularity Toggle */}
                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                      <button
                        onClick={() => setTrendGranularity("daily")}
                        className={`px-2 py-0.5 rounded transition ${
                          trendGranularity === "daily" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Day
                      </button>
                      <button
                        onClick={() => setTrendGranularity("weekly")}
                        className={`px-2 py-0.5 rounded transition ${
                          trendGranularity === "weekly" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Week
                      </button>
                      <button
                        onClick={() => setTrendGranularity("monthly")}
                        className={`px-2 py-0.5 rounded transition ${
                          trendGranularity === "monthly" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Month
                      </button>
                    </div>
                  </div>

                  <TaskCompletionTrendsChart
                    data={
                      trendGranularity === "weekly"
                        ? cycleData.trends.weekly
                        : trendGranularity === "monthly"
                        ? cycleData.trends.monthly
                        : cycleData.trends.daily
                    }
                    granularity={trendGranularity}
                  />
                </div>

                {/* Cycle Time vs Lead Time Percentile Comparison */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <BarChart3 size={18} className="text-purple-400" />
                        Cycle vs Lead Time Distribution
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Statistical percentiles (Avg, Median, 85th %ile, 95th %ile in hours)
                      </p>
                    </div>
                  </div>

                  <CycleLeadTimeComparisonChart
                    cycleStats={cycleData.cycleTime}
                    leadStats={cycleData.leadTime}
                  />
                </div>
              </div>

              {/* Stage Bottlenecks & Transition History */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                      <Hourglass size={18} className="text-amber-400" />
                      Workflow Stage Bottleneck Analysis
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Average dwell time spent in each lifecycle status before progression
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <StageBottleneckChart stageBottlenecks={cycleData.stageBottlenecks || []} />
                  </div>

                  {/* Stage Metrics Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                          <th className="pb-2">Stage</th>
                          <th className="pb-2 text-center">Tasks</th>
                          <th className="pb-2 text-right">Avg Dwell</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {cycleData.stageBottlenecks?.map((stage) => (
                          <tr key={stage.key} className="hover:bg-slate-800/20">
                            <td className="py-2.5 flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: stage.color }}
                              />
                              <span className="font-medium text-slate-200">{stage.name}</span>
                            </td>
                            <td className="py-2.5 text-center text-slate-300">{stage.taskCount}</td>
                            <td className="py-2.5 text-right font-bold text-slate-100">
                              {stage.averageHours}h
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

      {/* ========================================================================= */}
      {/* TAB 3: TASK COMPLETION & CYCLE-TIME METRICS (ANL-04)                       */}
      {/* ========================================================================= */}
      {activeTab === "cycle_time" && (
        <div className="space-y-6">
          {/* Cycle Time Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Timer size={18} className="text-purple-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                Task Completion, Cycle & Lead Time Analysis
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Sprint Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400">Sprint:</span>
                <select
                  value={cycleSprintFilter}
                  onChange={(e) => setCycleSprintFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Sprints</option>
                  {projectSprints.map((s) => (
                    <option key={s._id} value={s._id} className="bg-slate-900">
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Member Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400">Assignee:</span>
                <select
                  value={cycleMemberFilter}
                  onChange={(e) => setCycleMemberFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Members</option>
                  {projectMembersList.map((m) => (
                    <option key={m._id} value={m._id} className="bg-slate-900">
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400">Priority:</span>
                <select
                  value={cyclePriorityFilter}
                  onChange={(e) => setCyclePriorityFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Priorities</option>
                  <option value="urgent" className="bg-slate-900">Urgent</option>
                  <option value="critical" className="bg-slate-900">Critical</option>
                  <option value="high" className="bg-slate-900">High</option>
                  <option value="medium" className="bg-slate-900">Medium</option>
                  <option value="low" className="bg-slate-900">Low</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400">Period:</span>
                <select
                  value={cycleRangeFilter}
                  onChange={(e) => setCycleRangeFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Time</option>
                  <option value="today" className="bg-slate-900">Today</option>
                  <option value="this_week" className="bg-slate-900">This Week</option>
                  <option value="this_month" className="bg-slate-900">This Month</option>
                  <option value="last_30_days" className="bg-slate-900">Last 30 Days</option>
                  <option value="custom" className="bg-slate-900">Custom</option>
                </select>
              </div>

              {/* Custom Date Pickers */}
              {cycleRangeFilter === "custom" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={customCycleStart}
                    onChange={(e) => setCustomCycleStart(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                  />
                  <span className="text-slate-500 text-xs">to</span>
                  <input
                    type="date"
                    value={customCycleEnd}
                    onChange={(e) => setCustomCycleEnd(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Loading / Error states */}
          {cycleLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="animate-spin text-purple-400" size={24} />
              <p className="text-sm text-slate-400">Computing task completion & cycle-time metrics...</p>
            </div>
          ) : cycleError ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm">
              <AlertTriangle size={18} />
              <span>{cycleError}</span>
            </div>
          ) : !cycleData ? (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              <Timer size={32} className="mx-auto mb-2 opacity-50 text-purple-400" />
              <p>No completion or cycle time metrics found for this filter combination.</p>
            </div>
          ) : (
            <>
              {/* Statistical KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {/* Avg Cycle Time */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Avg Cycle Time</span>
                    <Hourglass size={16} className="text-purple-400" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xl sm:text-2xl font-bold text-slate-100">
                      {cycleData.cycleTime.average !== null ? `${cycleData.cycleTime.average}h` : "—"}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Start → Completion</span>
                  </div>
                </div>

                {/* Avg Lead Time */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Avg Lead Time</span>
                    <Timer size={16} className="text-pink-400" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xl sm:text-2xl font-bold text-slate-100">
                      {cycleData.leadTime.average !== null ? `${cycleData.leadTime.average}h` : "—"}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Created → Completion</span>
                  </div>
                </div>

                {/* 85th Percentile Lead Time */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">85th %ile Lead</span>
                    <Gauge size={16} className="text-indigo-400" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xl sm:text-2xl font-bold text-slate-100">
                      {cycleData.leadTime.p85 !== null ? `${cycleData.leadTime.p85}h` : "—"}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Service level (85% tasks)</span>
                  </div>
                </div>

                {/* Completion Rate */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Completion Rate</span>
                    <CheckCircle size={16} className="text-emerald-400" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                      {cycleData.summary.completionRate}%
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {cycleData.summary.completedTasks} / {cycleData.summary.totalTasks} tasks
                    </span>
                  </div>
                </div>

                {/* On-Time Completion */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">On-Time Rate</span>
                    <Clock size={16} className="text-blue-400" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xl sm:text-2xl font-bold text-slate-100">
                      {cycleData.summary.onTimeCompletionRate !== null
                        ? `${cycleData.summary.onTimeCompletionRate}%`
                        : "—"}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {cycleData.summary.onTimeCompletedCount} on time, {cycleData.summary.overdueCompletedCount} overdue
                    </span>
                  </div>
                </div>

                {/* Reopened Tasks */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Reopened Tasks</span>
                    <RotateCcw size={16} className={cycleData.summary.reopenedCount > 0 ? "text-amber-400" : "text-slate-400"} />
                  </div>
                  <div className="mt-2">
                    <div className={`text-xl sm:text-2xl font-bold ${cycleData.summary.reopenedCount > 0 ? "text-amber-400" : "text-slate-100"}`}>
                      {cycleData.summary.reopenedCount}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {cycleData.summary.reopenedRate}% reopen rate
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Limitation Notice when legacy tasks lack timestamps */}
              {!cycleData.summary.hasHistoricalCycleData && (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
                  <HelpCircle size={18} className="text-indigo-400 shrink-0" />
                  <span>
                    <strong>Notice:</strong> Completed tasks without explicit start timestamps are omitted from cycle time averages rather than inferred from updated times, preventing fabricated velocity data.
                  </span>
                </div>
              )}

              {/* Completion Trends & Distribution Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Completion Trends Chart */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-400" />
                        Task Completion Trends
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Volume of completed tasks over time based on actual completion dates
                      </p>
                    </div>

                    {/* Granularity Toggle */}
                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                      <button
                        onClick={() => setTrendGranularity("daily")}
                        className={`px-2 py-0.5 rounded transition ${
                          trendGranularity === "daily" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Day
                      </button>
                      <button
                        onClick={() => setTrendGranularity("weekly")}
                        className={`px-2 py-0.5 rounded transition ${
                          trendGranularity === "weekly" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Week
                      </button>
                      <button
                        onClick={() => setTrendGranularity("monthly")}
                        className={`px-2 py-0.5 rounded transition ${
                          trendGranularity === "monthly" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Month
                      </button>
                    </div>
                  </div>

                  <TaskCompletionTrendsChart
                    data={
                      trendGranularity === "weekly"
                        ? cycleData.trends.weekly
                        : trendGranularity === "monthly"
                        ? cycleData.trends.monthly
                        : cycleData.trends.daily
                    }
                    granularity={trendGranularity}
                  />
                </div>

                {/* Cycle Time vs Lead Time Percentile Comparison */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <BarChart3 size={18} className="text-purple-400" />
                        Cycle vs Lead Time Distribution
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Statistical percentiles (Avg, Median, 85th %ile, 95th %ile in hours)
                      </p>
                    </div>
                  </div>

                  <CycleLeadTimeComparisonChart
                    cycleStats={cycleData.cycleTime}
                    leadStats={cycleData.leadTime}
                  />
                </div>
              </div>

              {/* Stage Bottlenecks & Transition History */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                      <Hourglass size={18} className="text-amber-400" />
                      Workflow Stage Bottleneck Analysis
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Average dwell time spent in each lifecycle status before progression
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <StageBottleneckChart stageBottlenecks={cycleData.stageBottlenecks || []} />
                  </div>

                  {/* Stage Metrics Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                          <th className="pb-2">Stage</th>
                          <th className="pb-2 text-center">Tasks</th>
                          <th className="pb-2 text-right">Avg Dwell</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {cycleData.stageBottlenecks?.map((stage) => (
                          <tr key={stage.key} className="hover:bg-slate-800/20">
                            <td className="py-2.5 flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: stage.color }}
                              />
                              <span className="font-medium text-slate-200">{stage.name}</span>
                            </td>
                            <td className="py-2.5 text-center text-slate-300">{stage.taskCount}</td>
                            <td className="py-2.5 text-right font-bold text-slate-100">
                              {stage.averageHours}h
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CUSTOM REPORTS & DATE-RANGE FILTERING (ANL-06)                      */}
      {/* ========================================================================= */}
      {activeTab === "custom_reports" && (
        <div className="space-y-6">
          {/* Top Control Bar: Saved Reports Selector & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-cyan-400" />
              <div>
                <h2 className="text-sm font-semibold text-slate-200">
                  Custom Analytics Report Builder
                </h2>
                <span className="text-xs text-slate-400">
                  Configure dimensions, metrics, date-range filters, and grouping
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Saved Reports Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                <BookmarkIcon className="text-slate-400" size={14} />
                <span className="text-slate-400">Saved:</span>
                <select
                  value={selectedSavedReportId}
                  onChange={(e) => handleSelectSavedReport(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer max-w-[160px] truncate"
                >
                  <option value="" className="bg-slate-900">Custom Ad-hoc Report</option>
                  {savedReports.map((r) => (
                    <option key={r._id} value={r._id} className="bg-slate-900">
                      {r.name} {r.isShared ? "(Shared)" : "(Personal)"}
                    </option>
                  ))}
                </select>
                {selectedSavedReportId && (
                  <button
                    onClick={() => handleDeleteSavedReport(selectedSavedReportId)}
                    className="text-red-400 hover:text-red-300 ml-1 p-0.5"
                    title="Delete saved report"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Save Configuration Button */}
              <button
                onClick={() => setSaveModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600/30 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Save size={14} />
                <span>Save Report</span>
              </button>

              {/* Export Custom Report (CSV & PDF) */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                <button
                  onClick={() => handleExportReport("csv")}
                  disabled={exportLoading}
                  className="px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 font-medium transition flex items-center gap-1 disabled:opacity-50"
                  title="Export custom report as CSV"
                >
                  <FileSpreadsheet size={13} />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => handleExportReport("pdf")}
                  disabled={exportLoading}
                  className="px-2 py-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 font-medium transition flex items-center gap-1 disabled:opacity-50"
                  title="Export custom report as PDF"
                >
                  <Download size={13} />
                  <span>PDF</span>
                </button>
              </div>

              {/* Run / Apply Filters Button */}
              <button
                onClick={runCustomReport}
                disabled={reportLoading}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RefreshCw size={14} className={reportLoading ? "animate-spin" : ""} />
                <span>Run Report</span>
              </button>
            </div>
          </div>

          {/* Report Configuration Builder Drawer / Panel */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Report Dimensions & Filters
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 text-xs">
              {/* Group By Dimension */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-semibold block mb-1">Group By Dimension:</span>
                <select
                  value={reportGroupBy}
                  onChange={(e) => setReportGroupBy(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="status">Workflow Status</option>
                  <option value="priority">Priority Level</option>
                  <option value="assignee">Assigned Member</option>
                  <option value="sprint">Sprint</option>
                  <option value="milestone">Milestone</option>
                  <option value="none">No Grouping (Flat)</option>
                </select>
              </div>

              {/* Date Field to Filter On */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-semibold block mb-1">Date Field:</span>
                <select
                  value={reportDateField}
                  onChange={(e) => setReportDateField(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="createdAt">Creation Date</option>
                  <option value="dueDate">Due Date</option>
                  <option value="completedAt">Completion Date</option>
                  <option value="updatedAt">Last Updated Date</option>
                </select>
              </div>

              {/* Date Range Preset */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-semibold block mb-1">Date Interval:</span>
                <select
                  value={reportRange}
                  onChange={(e) => setReportRange(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* Sort Dimension */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-semibold block mb-1">Sort Order:</span>
                <div className="flex gap-1.5">
                  <select
                    value={reportSortBy}
                    onChange={(e) => setReportSortBy(e.target.value)}
                    className="w-2/3 bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-1.5 focus:outline-none"
                  >
                    <option value="createdAt">Date Created</option>
                    <option value="dueDate">Due Date</option>
                    <option value="completedAt">Date Done</option>
                    <option value="priority">Priority</option>
                    <option value="title">Title</option>
                    <option value="estimatedHours">Est. Hours</option>
                  </select>
                  <select
                    value={reportSortOrder}
                    onChange={(e) => setReportSortOrder(e.target.value)}
                    className="w-1/3 bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-1.5 focus:outline-none"
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </div>
              </div>

              {/* View / Chart Visualization Mode */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-semibold block mb-1">Visualization:</span>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setReportChartType("bar")}
                    className={`flex-1 py-1 rounded transition text-center ${
                      reportChartType === "bar" ? "bg-indigo-600 text-white font-bold" : "text-slate-400"
                    }`}
                    title="Bar chart"
                  >
                    Bar
                  </button>
                  <button
                    onClick={() => setReportChartType("pie")}
                    className={`flex-1 py-1 rounded transition text-center ${
                      reportChartType === "pie" ? "bg-indigo-600 text-white font-bold" : "text-slate-400"
                    }`}
                    title="Pie chart"
                  >
                    Pie
                  </button>
                  <button
                    onClick={() => setReportChartType("table")}
                    className={`flex-1 py-1 rounded transition text-center ${
                      reportChartType === "table" ? "bg-indigo-600 text-white font-bold" : "text-slate-400"
                    }`}
                    title="Tabular view only"
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Date Bounds when selected */}
            {reportRange === "custom" && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                <span className="text-slate-400 font-medium">Custom Bounds:</span>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Report Results */}
          {reportLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="animate-spin text-cyan-400" size={24} />
              <p className="text-sm text-slate-400">Aggregating and executing custom report...</p>
            </div>
          ) : reportError ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm">
              <AlertTriangle size={18} />
              <span>{reportError}</span>
            </div>
          ) : !reportResult ? (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              <FileText size={32} className="mx-auto mb-2 opacity-50 text-cyan-400" />
              <p>Configure filters above and click 'Run Report' to generate analytics.</p>
            </div>
          ) : (
            <>
              {/* Summary Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Tasks</span>
                  <span className="text-xl font-bold text-slate-100">{reportResult.summary.totalTasks}</span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Completed</span>
                  <span className="text-xl font-bold text-emerald-400">{reportResult.summary.completedTasks}</span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Overdue</span>
                  <span className={`text-xl font-bold ${reportResult.summary.overdueTasks > 0 ? "text-red-400" : "text-slate-100"}`}>
                    {reportResult.summary.overdueTasks}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Completion</span>
                  <span className="text-xl font-bold text-indigo-400">{reportResult.summary.completionRate}%</span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Est. Hours</span>
                  <span className="text-xl font-bold text-slate-100">{reportResult.summary.totalEstimatedHours}h</span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Story Points</span>
                  <span className="text-xl font-bold text-purple-400">{reportResult.summary.totalStoryPoints}</span>
                </div>
              </div>

              {/* Chart Visualization (if not 'table' only) */}
              {reportChartType !== "table" && (
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <BarChart3 size={18} className="text-cyan-400" />
                        Report Breakdown by {reportGroupBy.charAt(0).toUpperCase() + reportGroupBy.slice(1)}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Group-level distribution across chosen metric
                      </p>
                    </div>

                    {/* Metric Selector for Chart */}
                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                      <button
                        onClick={() => setReportMetric("count")}
                        className={`px-2 py-0.5 rounded transition ${
                          reportMetric === "count" ? "bg-cyan-600 text-white font-semibold" : "text-slate-400"
                        }`}
                      >
                        Tasks
                      </button>
                      <button
                        onClick={() => setReportMetric("estimatedHours")}
                        className={`px-2 py-0.5 rounded transition ${
                          reportMetric === "estimatedHours" ? "bg-cyan-600 text-white font-semibold" : "text-slate-400"
                        }`}
                      >
                        Hours
                      </button>
                      <button
                        onClick={() => setReportMetric("storyPoints")}
                        className={`px-2 py-0.5 rounded transition ${
                          reportMetric === "storyPoints" ? "bg-cyan-600 text-white font-semibold" : "text-slate-400"
                        }`}
                      >
                        Points
                      </button>
                    </div>
                  </div>

                  {reportChartType === "pie" ? (
                    <CustomReportPieChart groups={reportResult.groups || []} metric={reportMetric} />
                  ) : (
                    <CustomReportBarChart groups={reportResult.groups || []} metric={reportMetric} />
                  )}
                </div>
              )}

              {/* Detailed Tasks Table */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                      <TableIcon size={18} className="text-indigo-400" />
                      Report Task Records ({reportResult.pagination.total} total)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Showing page {reportResult.pagination.page} of {reportResult.pagination.pages}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="pb-2.5">Title</th>
                        <th className="pb-2.5">Status</th>
                        <th className="pb-2.5">Priority</th>
                        <th className="pb-2.5">Assignee</th>
                        <th className="pb-2.5">Due Date</th>
                        <th className="pb-2.5 text-center">Hours</th>
                        <th className="pb-2.5 text-center">Points</th>
                        <th className="pb-2.5 text-right">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {reportResult.tasks && reportResult.tasks.length > 0 ? (
                        reportResult.tasks.map((t) => (
                          <tr key={t._id} className="hover:bg-slate-800/20">
                            <td className="py-2.5 font-medium text-slate-200 max-w-[200px] truncate">
                              {t.title}
                            </td>
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 font-medium">
                                {t.status}
                              </span>
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  t.priority === "urgent"
                                    ? "bg-red-500/10 text-red-400"
                                    : t.priority === "high"
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-slate-800 text-slate-300"
                                }`}
                              >
                                {t.priority}
                              </span>
                            </td>
                            <td className="py-2.5 text-slate-300">
                              {t.assignedTo && t.assignedTo.length > 0 ? t.assignedTo[0].name : "Unassigned"}
                            </td>
                            <td className="py-2.5 text-slate-400">
                              {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-2.5 text-center text-slate-300">
                              {t.estimatedHours !== null && t.estimatedHours !== undefined ? t.estimatedHours : "—"}
                            </td>
                            <td className="py-2.5 text-center text-purple-400">
                              {t.storyPoints !== null && t.storyPoints !== undefined ? t.storyPoints : "—"}
                            </td>
                            <td className="py-2.5 text-right text-slate-500">
                              {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-500">
                            No tasks match the selected report criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {reportResult.pagination.pages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                    <span className="text-slate-400">
                      Page {reportResult.pagination.page} of {reportResult.pagination.pages}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                        disabled={reportResult.pagination.page <= 1}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setReportPage((p) => Math.min(reportResult.pagination.pages, p + 1))}
                        disabled={reportResult.pagination.page >= reportResult.pagination.pages}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Save Report Modal Dialog */}
          {saveModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <Save size={18} className="text-cyan-400" />
                    Save Report Configuration
                  </h3>
                  <button
                    onClick={() => setSaveModalOpen(false)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <XCircle size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveReport} className="space-y-4 text-xs">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Report Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Q4 Task Bottlenecks"
                      value={newReportName}
                      onChange={(e) => setNewReportName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Description (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Brief context for team members..."
                      value={newReportDesc}
                      onChange={(e) => setNewReportDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="shareReport"
                      checked={newReportIsShared}
                      onChange={(e) => setNewReportIsShared(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                    />
                    <label htmlFor="shareReport" className="text-slate-300 cursor-pointer">
                      Share with all members of this project team
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSaveModalOpen(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reportSaving || !newReportName.trim()}
                      className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-50"
                    >
                      {reportSaving ? "Saving..." : "Save Configuration"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: WORKSPACE-WIDE ANALYTICS & REPORTING (ANL-08) */}
      {/* ========================================================================= */}
      {activeTab === "workspace" && (
        <div className="space-y-6">
          {/* Workspace Filters & Project Scoping */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Building size={20} className="text-pink-400" />
              <div>
                <h2 className="text-sm font-semibold text-slate-200">
                  {workspaceData?.workspaceName || "Workspace"} Multi-Project Overview
                </h2>
                <span className="text-xs text-slate-400">
                  Aggregating metrics across {workspaceData?.summary?.totalProjects ?? 0} authorized project(s)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Project Filter (All vs Specific) */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                <FolderKanban size={14} className="text-slate-400" />
                <span className="text-slate-400">Projects:</span>
                <select
                  value={workspaceFilterProjects}
                  onChange={(e) => setWorkspaceFilterProjects(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer max-w-[150px] truncate"
                >
                  <option value="all" className="bg-slate-900">All Authorized Projects</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id} className="bg-slate-900">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Export Workspace Report */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                <button
                  onClick={() => handleExportReport("csv")}
                  disabled={exportLoading}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 font-medium transition flex items-center gap-1 disabled:opacity-50"
                  title="Export workspace analytics as CSV"
                >
                  <FileSpreadsheet size={13} />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => handleExportReport("pdf")}
                  disabled={exportLoading}
                  className="px-2.5 py-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 font-medium transition flex items-center gap-1 disabled:opacity-50"
                  title="Export workspace analytics as PDF"
                >
                  <Download size={13} />
                  <span>PDF</span>
                </button>
              </div>

              {/* Refresh Workspace Data */}
              <button
                onClick={fetchWorkspaceAnalytics}
                disabled={workspaceLoading}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
                title="Refresh workspace analytics"
              >
                <RefreshCw size={14} className={workspaceLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Loading / Error States */}
          {workspaceLoading ? (
            <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800/60">
              <RefreshCw className="animate-spin mx-auto mb-2 text-indigo-400" size={24} />
              <span>Calculating workspace analytics and project ranking...</span>
            </div>
          ) : workspaceError ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{workspaceError}</span>
            </div>
          ) : !workspaceData || workspaceData.summary.totalProjects === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800/60 space-y-2">
              <Building size={36} className="mx-auto text-slate-500 opacity-60" />
              <h3 className="font-semibold text-slate-200">No Projects Found in Workspace</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                This workspace does not currently have any active projects or you have not been granted access to them.
              </p>
            </div>
          ) : (
            <>
              {/* Workspace Top KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {/* Workspace Health */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold">Workspace Health</span>
                    <HeartPulse size={16} style={{ color: workspaceData.summary.healthColor }} />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold block" style={{ color: workspaceData.summary.healthColor }}>
                      {workspaceData.summary.averageHealthScore !== null ? `${workspaceData.summary.averageHealthScore}/100` : "N/A"}
                    </span>
                    <span className="text-[11px] font-medium" style={{ color: workspaceData.summary.healthColor }}>
                      {workspaceData.summary.healthState}
                    </span>
                  </div>
                </div>

                {/* Active Projects */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold">Active Projects</span>
                    <FolderKanban size={16} className="text-indigo-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-slate-100 block">{workspaceData.summary.totalProjects}</span>
                    <span className="text-[11px] text-slate-400">Authorized Tenancies</span>
                  </div>
                </div>

                {/* Total Tasks & Completion */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold">Task Progress</span>
                    <CheckCircle size={16} className="text-emerald-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-slate-100 block">
                      {workspaceData.summary.completionRate}%
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {workspaceData.summary.completedTasks} of {workspaceData.summary.totalTasks} Tasks
                    </span>
                  </div>
                </div>

                {/* Overdue Work */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold">Overdue Tasks</span>
                    <Clock size={16} className="text-red-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-red-400 block">{workspaceData.summary.overdueTasks}</span>
                    <span className="text-[11px] text-slate-400">{workspaceData.summary.overdueRate}% of Total</span>
                  </div>
                </div>

                {/* Estimated Hours */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold">Estimated Hours</span>
                    <Timer size={16} className="text-blue-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-slate-100 block">
                      {workspaceData.summary.completedEstimatedHours}
                      <span className="text-xs font-normal text-slate-400"> / {workspaceData.summary.totalEstimatedHours}h</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Work Hours Tracked</span>
                  </div>
                </div>

                {/* Story Points */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold">Story Points</span>
                    <Zap size={16} className="text-amber-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-slate-100 block">
                      {workspaceData.summary.completedStoryPoints}
                      <span className="text-xs font-normal text-slate-400"> / {workspaceData.summary.totalStoryPoints}p</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Velocity Points</span>
                  </div>
                </div>
              </div>

              {/* Project Comparison & Ranking Matrix */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                      <Trophy size={18} className="text-amber-400" />
                      Project Comparison & Performance Ranking
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Objective ranking derived from real-time health score, milestone slippage, and completion percentage
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="pb-2.5">Rank</th>
                        <th className="pb-2.5">Project Name</th>
                        <th className="pb-2.5 text-center">Health Status</th>
                        <th className="pb-2.5 text-center">Progress</th>
                        <th className="pb-2.5 text-center">Tasks</th>
                        <th className="pb-2.5 text-center">Overdue</th>
                        <th className="pb-2.5 text-center">Est. Hours</th>
                        <th className="pb-2.5 text-center">Story Points</th>
                        <th className="pb-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {workspaceData.projectRankings.map((p, idx) => (
                        <tr key={p.projectId} className="hover:bg-slate-800/20 transition">
                          <td className="py-3 font-bold text-slate-400">
                            #{idx + 1}
                          </td>
                          <td className="py-3">
                            <span className="font-semibold text-slate-200 block">{p.projectName}</span>
                            <span className="text-[11px] text-slate-500 truncate max-w-xs block">
                              {p.description || "No project description"}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span
                              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                              style={{
                                backgroundColor: `${p.statusColor}15`,
                                color: p.statusColor,
                                border: `1px solid ${p.statusColor}30`,
                              }}
                            >
                              {p.healthScore !== null ? `${p.healthScore} - ${p.healthState}` : "Insufficient Data"}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-slate-200">{p.completionRate}%</span>
                              <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-500 h-full rounded-full"
                                  style={{ width: `${Math.min(100, p.completionRate)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-center text-slate-300">
                            {p.completedTasks} / {p.totalTasks}
                          </td>
                          <td className="py-3 text-center">
                            <span className={`font-semibold ${p.overdueTasks > 0 ? "text-red-400" : "text-slate-400"}`}>
                              {p.overdueTasks}
                            </span>
                          </td>
                          <td className="py-3 text-center text-slate-300">
                            {p.completedEstimatedHours} / {p.totalEstimatedHours}h
                          </td>
                          <td className="py-3 text-center text-slate-300">
                            {p.completedStoryPoints} / {p.totalStoryPoints}p
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedProjectId(p.projectId);
                                setActiveTab("overview");
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 font-medium transition text-xs"
                            >
                              View Analytics
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Workspace Team Capacity & Workload Imbalance */}
              {workspaceData.teamWorkload && workspaceData.teamWorkload.members?.length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <Users size={18} className="text-blue-400" />
                        Workspace Member Capacity & Allocation
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Team utilization across all authorized projects ({workspaceData.teamWorkload.teamUtilizationRate}% Overall Utilization)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {workspaceData.teamWorkload.members.map((m) => (
                      <div
                        key={m.userId}
                        className={`p-3.5 rounded-xl border ${
                          m.isOverAllocated
                            ? "border-red-500/40 bg-red-950/20"
                            : "border-slate-800 bg-slate-950"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-slate-200 truncate">{m.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              m.isOverAllocated
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {m.utilizationRate}%
                          </span>
                        </div>
                        <div className="space-y-1 text-slate-400 text-[11px]">
                          <div className="flex justify-between">
                            <span>Committed:</span>
                            <span className="text-slate-200 font-medium">{m.committedWork}h / {m.capacity}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Completed:</span>
                            <span className="text-slate-200 font-medium">{m.completedWork}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Active Tasks:</span>
                            <span className="text-slate-200 font-medium">{m.assignedCount} tasks</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

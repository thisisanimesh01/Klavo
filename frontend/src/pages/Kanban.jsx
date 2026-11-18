import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axiosClient from "../api/axiosClient";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskModal from "../components/TaskModal";
import TaskTemplateModal from "../components/TaskTemplateModal";
import SprintModal from "../components/SprintModal";
import MilestoneModal from "../components/MilestoneModal";
import WorkflowModal from "../components/WorkflowModal";
import AutomationModal from "../components/AutomationModal";
import GanttTimelineView from "../components/GanttTimelineView";
import BacklogView from "../components/BacklogView";
import SavedViewsBar from "../components/SavedViewsBar";
import AdvancedFilterBar from "../components/AdvancedFilterBar";
import PriorityBadge from "../components/PriorityBadge";
import ThemeToggle from "../components/ThemeToggle";
import ActivityPanel from "../components/ActivityPanel";
import ChatPanel from "../components/ChatPanel";
import socket from "../socket";
import {
  Search,
  Filter,
  Plus,
  LayoutTemplate,
  Trash2,
  Calendar,
  CheckSquare,
  Clock,
  Tag,
  ArrowUpDown,
  X,
  Zap,
  Play,
  CheckCircle2,
  Archive,
  Layers,
  ChevronRight,
  TrendingUp,
  ShieldAlert,
  CornerDownRight,
  Link,
  Flag,
  Sliders,
  FileText,
  BookOpen,
  BarChart2,
} from "lucide-react";

const COLUMNS = [
  { id: "todo", title: "Todo", border: "border-t-slate-400" },
  { id: "in-progress", title: "In Progress", border: "border-t-blue-500" },
  { id: "review", title: "In Review", border: "border-t-amber-500" },
  { id: "done", title: "Done", border: "border-t-emerald-500" },
];

export default function Kanban() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.auth?.user);

  const [tasks, setTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(null);
  const [members, setMembers] = useState([]);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [sprintModalOpen, setSprintModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingSprint, setEditingSprint] = useState(null);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [createStatus, setCreateStatus] = useState("todo");

  const [activeTab, setActiveTab] = useState("board"); // 'board' | 'backlog' | 'gantt' | 'activity' | 'chat'

  // Advanced Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState("all");
  const [selectedLabel, setSelectedLabel] = useState("all");
  const [selectedSprintId, setSelectedSprintId] = useState("all");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [dependencyFilter, setDependencyFilter] = useState("all");
  const [sortBy, setSortBy] = useState("order");
  const [sortOrder, setSortOrder] = useState("asc");
  const [groupBy, setGroupBy] = useState("none");
  const [mobileColumnId, setMobileColumnId] = useState("all");

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get(`/tasks/project/${projectId}`);
      setTasks(res.data || []);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchSprints = useCallback(async () => {
    try {
      const res = await axiosClient.get(`/sprints/project/${projectId}`);
      setSprints(res.data || []);
    } catch (err) {
      console.error("Failed to fetch sprints:", err);
    }
  }, [projectId]);

  const fetchMilestones = useCallback(async () => {
    try {
      const res = await axiosClient.get(`/milestones/project/${projectId}`);
      setMilestones(res.data || []);
    } catch (err) {
      console.error("Failed to fetch milestones:", err);
    }
  }, [projectId]);

  const fetchWorkflow = useCallback(async () => {
    try {
      const res = await axiosClient.get(`/workflows/project/${projectId}`);
      setWorkflow(res.data);
    } catch (err) {
      console.error("Failed to fetch workflow:", err);
    }
  }, [projectId]);

  const fetchSavedViews = useCallback(async () => {
    try {
      const res = await axiosClient.get(`/saved-views/project/${projectId}`);
      const views = res.data || [];
      setSavedViews(views);

      // Check for user's default saved view if none selected
      if (!activeViewId) {
        const defaultView = views.find((v) => v.isDefault);
        if (defaultView) {
          applySavedView(defaultView);
        }
      }
    } catch (err) {
      console.error("Failed to fetch saved views:", err);
    }
  }, [projectId, activeViewId]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await axiosClient.get(`/projects/${projectId}/members`);
      setMembers(res.data?.members || []);
    } catch (err) {
      // Non-critical if members endpoint format varies
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchTasks();
      fetchSprints();
      fetchMilestones();
      fetchWorkflow();
      fetchSavedViews();
      fetchMembers();
    }
  }, [projectId, fetchTasks, fetchSprints, fetchMilestones, fetchWorkflow, fetchSavedViews, fetchMembers]);

  // Socket.IO real-time synchronization
  useEffect(() => {
    if (!projectId) return;
    if (!socket.connected) socket.connect();

    socket.emit("joinProject", { projectId });

    const taskCreated = (task) => {
      if (String(task.projectId) === String(projectId)) {
        setTasks((prev) =>
          prev.some((t) => t._id === task._id) ? prev : [...prev, task]
        );
      }
    };

    const taskUpdated = (task) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    };

    const taskMoved = (task) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    };

    const taskDeleted = ({ taskId }) => {
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    };

    const tasksBatchUpdated = () => {
      fetchTasks();
    };

    const tasksReordered = () => {
      fetchTasks();
    };

    const sprintCreated = () => fetchSprints();
    const sprintUpdated = () => fetchSprints();
    const sprintStarted = () => fetchSprints();
    const sprintCompleted = () => {
      fetchSprints();
      fetchTasks();
    };

    const savedViewCreated = (newView) => {
      setSavedViews((prev) =>
        prev.some((v) => v._id === newView._id) ? prev : [newView, ...prev]
      );
    };

    const savedViewUpdated = (updatedView) => {
      setSavedViews((prev) =>
        prev.map((v) => (v._id === updatedView._id ? updatedView : v))
      );
    };

    const savedViewDeleted = ({ viewId }) => {
      setSavedViews((prev) => prev.filter((v) => v._id !== viewId));
      if (activeViewId === viewId) {
        clearFilters();
      }
    };

    socket.on("taskCreated", taskCreated);
    socket.on("taskUpdated", taskUpdated);
    socket.on("taskMoved", taskMoved);
    socket.on("taskDeleted", taskDeleted);
    socket.on("tasksBatchUpdated", tasksBatchUpdated);
    socket.on("tasksReordered", tasksReordered);
    socket.on("sprintCreated", sprintCreated);
    socket.on("sprintUpdated", sprintUpdated);
    socket.on("sprintStarted", sprintStarted);
    socket.on("sprintCompleted", sprintCompleted);
    socket.on("savedViewCreated", savedViewCreated);
    socket.on("savedViewUpdated", savedViewUpdated);
    socket.on("savedViewDeleted", savedViewDeleted);

    return () => {
      socket.emit("leaveProject", { projectId });
      socket.off("taskCreated", taskCreated);
      socket.off("taskUpdated", taskUpdated);
      socket.off("taskMoved", taskMoved);
      socket.off("taskDeleted", taskDeleted);
      socket.off("tasksBatchUpdated", tasksBatchUpdated);
      socket.off("tasksReordered", tasksReordered);
      socket.off("sprintCreated", sprintCreated);
      socket.off("sprintUpdated", sprintUpdated);
      socket.off("sprintStarted", sprintStarted);
      socket.off("sprintCompleted", sprintCompleted);
      socket.off("savedViewCreated", savedViewCreated);
      socket.off("savedViewUpdated", savedViewUpdated);
      socket.off("savedViewDeleted", savedViewDeleted);
    };
  }, [projectId, fetchSprints, fetchTasks, activeViewId]);

  // Extract unique labels for filter options
  const availableLabels = useMemo(() => {
    const labelSet = new Set();
    tasks.forEach((t) => {
      if (Array.isArray(t.labels)) {
        t.labels.forEach((l) => labelSet.add(l.name));
      }
    });
    return Array.from(labelSet).sort();
  }, [tasks]);

  // Currently active sprint if any
  const activeSprint = useMemo(() => {
    return sprints.find((s) => s.status === "active");
  }, [sprints]);

  // Dynamic Kanban columns resolved from workflow
  const boardColumns = useMemo(() => {
    if (workflow && Array.isArray(workflow.statuses) && workflow.statuses.length > 0) {
      return workflow.statuses
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((st) => ({
          id: st.key,
          title: st.name,
          color: st.color || "#6366f1",
          category: st.category,
        }));
    }
    return COLUMNS.map((c) => ({
      id: c.id,
      title: c.title,
      color:
        c.id === "done"
          ? "#10b981"
          : c.id === "review"
          ? "#f59e0b"
          : c.id === "in-progress"
          ? "#3b82f6"
          : "#94a3b8",
      category: c.id === "in-progress" ? "in_progress" : c.id,
    }));
  }, [workflow]);

  // Priority weight for sorting
  const priorityWeight = {
    urgent: 5,
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Comprehensive Filter & Search Pipeline
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

    return tasks.filter((t) => {
      // 1. Text Search across Title, Description, and Labels
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(query);
        const matchesDesc = t.description?.toLowerCase().includes(query);
        const matchesLabel = t.labels?.some((l) => l.name.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDesc && !matchesLabel) return false;
      }

      // 2. Multi-Priority Filter
      if (selectedPriorities.length > 0 && !selectedPriorities.includes(t.priority)) {
        return false;
      }

      // 3. Multi-Status Filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(t.status)) {
        return false;
      }

      // 4. Assignee Filter
      if (selectedAssignee !== "all") {
        if (selectedAssignee === "unassigned") {
          if (Array.isArray(t.assignedTo) && t.assignedTo.length > 0) return false;
        } else if (selectedAssignee === "me" && currentUser?._id) {
          const isAssigned = t.assignedTo?.some(
            (u) => (u._id || u) === currentUser._id
          );
          if (!isAssigned) return false;
        } else {
          const isAssigned = t.assignedTo?.some(
            (u) => (u._id || u) === selectedAssignee
          );
          if (!isAssigned) return false;
        }
      }

      // 5. Label Filter
      if (selectedLabel !== "all") {
        const hasLabel = t.labels?.some(
          (l) => l.name.toLowerCase() === selectedLabel.toLowerCase()
        );
        if (!hasLabel) return false;
      }

      // 6. Sprint Filter
      if (selectedSprintId === "backlog") {
        if (t.sprintId) return false;
      } else if (selectedSprintId !== "all") {
        const tSprint = t.sprintId?._id || t.sprintId;
        if (tSprint !== selectedSprintId) return false;
      }

      // 7. Milestone Filter
      if (selectedMilestoneId === "none") {
        if (t.milestoneId) return false;
      } else if (selectedMilestoneId !== "all") {
        const tMilestone = t.milestoneId?._id || t.milestoneId;
        if (tMilestone !== selectedMilestoneId) return false;
      }

      // 8. Due Date Range Filter
      if (dueDateFilter !== "all") {
        if (dueDateFilter === "no_due_date") {
          if (t.dueDate) return false;
        } else if (dueDateFilter === "overdue") {
          if (!t.dueDate || new Date(t.dueDate) >= startOfToday) return false;
        } else if (dueDateFilter === "today") {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          if (d < startOfToday || d > endOfToday) return false;
        } else if (dueDateFilter === "this_week") {
          if (!t.dueDate) return false;
          const dayOfWeek = now.getDay();
          const diffToMonday = (dayOfWeek + 6) % 7;
          const startOfWeek = new Date(startOfToday.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
          const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
          const d = new Date(t.dueDate);
          if (d < startOfWeek || d > endOfWeek) return false;
        } else if (dueDateFilter === "next_week") {
          if (!t.dueDate) return false;
          const dayOfWeek = now.getDay();
          const diffToMonday = (dayOfWeek + 6) % 7;
          const startOfNextWeek = new Date(startOfToday.getTime() + (7 - diffToMonday) * 24 * 60 * 60 * 1000);
          const endOfNextWeek = new Date(startOfNextWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
          const d = new Date(t.dueDate);
          if (d < startOfNextWeek || d > endOfNextWeek) return false;
        }
      }

      // 9. Dependency Filter
      if (dependencyFilter !== "all") {
        if (dependencyFilter === "blocked_only" && !t.isBlocked) return false;
        if (dependencyFilter === "unblocked_only" && t.isBlocked) return false;
        if (dependencyFilter === "has_dependencies" && (!t.dependencies || t.dependencies.length === 0)) return false;
        if (dependencyFilter === "no_dependencies" && t.dependencies && t.dependencies.length > 0) return false;
      }

      return true;
    });
  }, [
    tasks,
    searchQuery,
    selectedPriorities,
    selectedStatuses,
    selectedAssignee,
    selectedLabel,
    selectedSprintId,
    selectedMilestoneId,
    dueDateFilter,
    dependencyFilter,
    currentUser,
  ]);

  // Tasks grouped and sorted for each board column
  const tasksByStatus = (status) =>
    filteredTasks
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const factor = sortOrder === "desc" ? -1 : 1;
        if (sortBy === "priority") {
          const pa = priorityWeight[a.priority] || 2;
          const pb = priorityWeight[b.priority] || 2;
          if (pa !== pb) return (pb - pa) * factor;
        } else if (sortBy === "dueDate") {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return (new Date(a.dueDate) - new Date(b.dueDate)) * factor;
        } else if (sortBy === "createdAt") {
          return (new Date(b.createdAt) - new Date(a.createdAt)) * factor;
        } else if (sortBy === "updatedAt") {
          return (new Date(b.updatedAt) - new Date(a.updatedAt)) * factor;
        } else if (sortBy === "title") {
          return (a.title || "").localeCompare(b.title || "") * factor;
        } else if (sortBy === "estimatedHours") {
          return ((a.estimatedHours || 0) - (b.estimatedHours || 0)) * factor;
        }
        // Default order
        const ao = a.order ?? 0;
        const bo = b.order ?? 0;
        if (ao !== bo) return (ao - bo) * factor;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

  // Grouped task sections when groupBy !== "none"
  const groupedSections = useMemo(() => {
    if (groupBy === "none") return null;

    const sections = {};
    for (const t of filteredTasks) {
      let key = "Unassigned / General";
      if (groupBy === "priority") key = (t.priority || "medium").toUpperCase();
      else if (groupBy === "status") {
        const st = boardColumns.find((c) => c.id === t.status);
        key = st ? st.title : t.status;
      } else if (groupBy === "assignee") {
        if (!t.assignedTo || t.assignedTo.length === 0) key = "Unassigned";
        else key = t.assignedTo.map((u) => u.name || "Member").join(", ");
      } else if (groupBy === "milestone") {
        key = t.milestoneId?.name || "No Milestone";
      }

      if (!sections[key]) sections[key] = [];
      sections[key].push(t);
    }
    return sections;
  }, [filteredTasks, groupBy, boardColumns]);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    try {
      await axiosClient.put(`/tasks/${draggableId}/move`, {
        status: destination.droppableId,
        order: destination.index,
      });
      fetchTasks();
    } catch (err) {
      if (err.response?.data?.isBlocked) {
        alert(err.response.data.message);
      }
      fetchTasks();
    }
  };

  const openCreateModal = (status) => {
    setEditingTask(null);
    setCreateStatus(status || "todo");
    setModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const openCreateMilestoneModal = () => {
    setEditingMilestone(null);
    setMilestoneModalOpen(true);
  };

  const openEditMilestoneModal = (milestone) => {
    setEditingMilestone(milestone);
    setMilestoneModalOpen(true);
  };

  const handleTaskSaved = () => {
    fetchTasks();
    fetchSprints();
    setModalOpen(false);
  };

  const deleteTask = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await axiosClient.delete(`/tasks/${id}`);
      fetchTasks();
      fetchSprints();
    } catch (err) {
      alert("Failed to delete task");
    }
  };

  const handleStartSprint = async (sprintId) => {
    try {
      await axiosClient.post(`/sprints/${sprintId}/start`);
      fetchSprints();
      setSelectedSprintId(sprintId);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to start sprint");
    }
  };

  const handleCompleteSprint = async (sprintId) => {
    if (!confirm("Complete this active sprint? Incomplete tasks will return to the product backlog.")) return;
    try {
      await axiosClient.post(`/sprints/${sprintId}/complete`);
      fetchSprints();
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to complete sprint");
    }
  };

  // Saved View Operations
  const applySavedView = (view) => {
    setActiveViewId(view._id);
    const f = view.filters || {};
    setSearchQuery(f.search || "");
    setSelectedPriorities(f.priorities || []);
    setSelectedStatuses(f.statuses || []);
    setSelectedAssignee(f.assignees?.[0] || "all");
    setSelectedLabel(f.labels?.[0] || "all");
    setSelectedSprintId(f.sprintId || "all");
    setSelectedMilestoneId(f.milestoneId || "all");
    setDueDateFilter(f.dueDateFilter || "all");
    setDependencyFilter(f.dependencyFilter || "all");
    setSortBy(view.sortBy || "order");
    setSortOrder(view.sortOrder || "asc");
    setGroupBy(view.groupBy || "none");
  };

  const clearFilters = () => {
    setActiveViewId(null);
    setSearchQuery("");
    setSelectedPriorities([]);
    setSelectedStatuses([]);
    setSelectedAssignee("all");
    setSelectedLabel("all");
    setSelectedSprintId("all");
    setSelectedMilestoneId("all");
    setDueDateFilter("all");
    setDependencyFilter("all");
    setSortBy("order");
    setSortOrder("asc");
    setGroupBy("none");
  };

  const handleCreateSavedView = async ({ name, description, isShared, isDefault }) => {
    const payload = {
      name,
      description,
      projectId,
      isShared,
      isDefault,
      sortBy,
      sortOrder,
      groupBy,
      filters: {
        search: searchQuery,
        priorities: selectedPriorities,
        statuses: selectedStatuses,
        assignees: selectedAssignee !== "all" ? [selectedAssignee] : [],
        labels: selectedLabel !== "all" ? [selectedLabel] : [],
        sprintId: selectedSprintId,
        milestoneId: selectedMilestoneId,
        dueDateFilter,
        dependencyFilter,
      },
    };

    const res = await axiosClient.post("/saved-views", payload);
    const newView = res.data;
    setSavedViews((prev) => [newView, ...prev]);
    setActiveViewId(newView._id);
  };

  const handleDeleteSavedView = async (viewId) => {
    try {
      await axiosClient.delete(`/saved-views/${viewId}`);
      setSavedViews((prev) => prev.filter((v) => v._id !== viewId));
      if (activeViewId === viewId) {
        clearFilters();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete saved view");
    }
  };

  if (loading && tasks.length === 0) {
    return <div className="p-6 text-slate-500">Loading Kanban board...</div>;
  }

  return (
    <div className="min-h-screen app-bg p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Project Kanban & Backlog
            </h1>
            <p className="text-xs text-slate-500">
              Product backlog prioritization, sprint iterations, dependencies, saved views, and agile execution
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditingSprint(null);
                setSprintModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs text-indigo-600 dark:text-indigo-400"
            >
              <Zap className="w-4 h-4 text-indigo-600" />
              New Sprint
            </button>
            <button
              onClick={() => setWorkflowModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs text-slate-700 dark:text-slate-300"
              title="Configure Custom Workflow & Status Columns"
            >
              <Sliders className="w-4 h-4 text-slate-500" />
              Workflow
            </button>
            <button
              onClick={() => navigate(`/documents/${projectId}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs text-slate-700 dark:text-slate-300"
              title="Project Documents & Rich Text Editor"
            >
              <FileText className="w-4 h-4 text-indigo-500" />
              Docs
            </button>
            <button
              onClick={() => navigate(`/wiki/${projectId}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs text-slate-700 dark:text-slate-300"
              title="Project Wiki & Knowledge Base (DOC-07)"
            >
              <BookOpen className="w-4 h-4 text-amber-500" />
              Wiki
            </button>
            <button
              onClick={() => setAutomationModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs text-indigo-600 dark:text-indigo-400"
              title="Configure Automation Rules and Recurring Tasks"
            >
              <Zap className="w-4 h-4 text-indigo-500" />
              Automations
            </button>
            <button
              onClick={() => setTemplateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs"
            >
              <LayoutTemplate className="w-4 h-4 text-slate-500" />
              Blueprints
            </button>
            <button
              onClick={() => openCreateModal("todo")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Tab switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 sm:pb-0">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
            {[
              { id: "board", label: "Kanban Board" },
              { id: "backlog", label: "Product Backlog" },
              { id: "gantt", label: "Milestones & Gantt" },
              { id: "activity", label: "Activity" },
              { id: "chat", label: "Chat" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition whitespace-nowrap min-h-[40px] flex items-center ${
                  activeTab === tab.id
                    ? "border-b-2 border-indigo-600 text-indigo-600 font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate(`/analytics/${projectId}`)}
            className="self-end sm:self-auto flex items-center gap-1.5 px-3 py-1.5 mb-1 text-xs font-medium rounded-lg text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/20 transition min-h-[36px]"
            title="Open Project Analytics Dashboard"
          >
            <BarChart2 size={14} />
            <span>Analytics</span>
          </button>
        </div>

        {/* Saved Views Navigation Bar (Available across Board and Backlog) */}
        {(activeTab === "board" || activeTab === "backlog") && (
          <SavedViewsBar
            savedViews={savedViews}
            activeViewId={activeViewId}
            onSelectView={applySavedView}
            onClearView={clearFilters}
            onCreateView={handleCreateSavedView}
            onDeleteView={handleDeleteSavedView}
            currentUserId={currentUser?._id}
            isTeamOwner={true}
          />
        )}

        {/* Interactive Gantt / Timeline View Tab */}
        {activeTab === "gantt" && (
          <GanttTimelineView
            projectId={projectId}
            milestones={milestones}
            workflow={workflow}
            tasks={tasks}
            sprints={sprints}
            onOpenCreateMilestone={openCreateMilestoneModal}
            onOpenEditMilestone={openEditMilestoneModal}
            onOpenEditTask={openEditModal}
            onRefresh={() => {
              fetchTasks();
              fetchMilestones();
            }}
          />
        )}

        {/* Dedicated Backlog View Tab */}
        {activeTab === "backlog" && (
          <BacklogView
            projectId={projectId}
            tasks={filteredTasks}
            sprints={sprints}
            onTasksUpdated={() => {
              fetchTasks();
              fetchSprints();
            }}
            onOpenCreateTask={openCreateModal}
            onOpenEditTask={openEditModal}
            onOpenCreateSprint={() => {
              setEditingSprint(null);
              setSprintModalOpen(true);
            }}
          />
        )}

        {/* Interactive Kanban Board Tab */}
        {activeTab === "board" && (
          <div className="space-y-4">
            {/* Active Sprint Banner (if one exists) */}
            {activeSprint && (
              <div className="bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-transparent p-4 rounded-2xl border border-indigo-100 dark:border-indigo-950 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {activeSprint.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                        Active Iteration
                      </span>
                    </div>
                    {activeSprint.goal && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Sprint Goal: {activeSprint.goal}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium">
                  {activeSprint.startDate && activeSprint.endDate && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(activeSprint.startDate).toLocaleDateString()} –{" "}
                        {new Date(activeSprint.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => handleCompleteSprint(activeSprint._id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Complete Sprint
                  </button>
                </div>
              </div>
            )}

            {/* Advanced Multi-Attribute Filter & Search Bar */}
            <AdvancedFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedPriorities={selectedPriorities}
              onPrioritiesChange={setSelectedPriorities}
              selectedStatuses={selectedStatuses}
              onStatusesChange={setSelectedStatuses}
              selectedAssignee={selectedAssignee}
              onAssigneeChange={setSelectedAssignee}
              selectedLabel={selectedLabel}
              onLabelChange={setSelectedLabel}
              selectedSprintId={selectedSprintId}
              onSprintChange={setSelectedSprintId}
              selectedMilestoneId={selectedMilestoneId}
              onMilestoneChange={setSelectedMilestoneId}
              dueDateFilter={dueDateFilter}
              onDueDateFilterChange={setDueDateFilter}
              dependencyFilter={dependencyFilter}
              onDependencyFilterChange={setDependencyFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              onResetFilters={clearFilters}
              workflowStatuses={boardColumns.map((c) => ({ key: c.id, name: c.title }))}
              sprints={sprints}
              milestones={milestones}
              members={members}
              availableLabels={availableLabels}
            />

            {/* Grouped View Accordion / Sections when Group By is active */}
            {groupBy !== "none" && groupedSections && (
              <div className="space-y-4">
                {Object.entries(groupedSections).map(([groupTitle, groupTasks]) => (
                  <div
                    key={groupTitle}
                    className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        {groupTitle}
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {groupTasks.length}
                        </span>
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {boardColumns.map((col) => {
                        const colTasks = groupTasks.filter((t) => t.status === col.id);
                        return (
                          <div
                            key={col.id}
                            className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-2 min-h-[120px]"
                          >
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                              <span>{col.title}</span>
                              <span className="text-[10px]">{colTasks.length}</span>
                            </div>
                            <div className="space-y-1.5">
                              {colTasks.map((task) => (
                                <div
                                  key={task._id}
                                  onClick={() => openEditModal(task)}
                                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs hover:border-indigo-500 border border-transparent cursor-pointer transition shadow-2xs"
                                >
                                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                                    {task.title}
                                  </div>
                                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                                    <PriorityBadge priority={task.priority} />
                                    {task.dueDate && (
                                      <span>
                                        {new Date(task.dueDate).toLocaleDateString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Standard DragDrop Board Columns when groupBy === 'none' */}
            {groupBy === "none" && (
              <div className="space-y-3">
                {/* Mobile Column Quick Selector / Tabs (< md) */}
                <div className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <button
                    onClick={() => setMobileColumnId("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition min-h-[36px] flex items-center gap-1.5 border ${
                      mobileColumnId === "all"
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span>All Columns</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-bold">
                      {tasks.length}
                    </span>
                  </button>
                  {boardColumns.map((col) => {
                    const colCount = tasksByStatus(col.id).length;
                    const isSelected = mobileColumnId === col.id;
                    return (
                      <button
                        key={col.id}
                        onClick={() => setMobileColumnId(col.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition min-h-[36px] flex items-center gap-1.5 border ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: col.color || "#6366f1" }}
                        />
                        <span>{col.title}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-bold">
                          {colCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <DragDropContext onDragEnd={handleDragEnd}>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {boardColumns.map((col) => {
                      const columnTasks = tasksByStatus(col.id);
                      const isHiddenOnMobile = mobileColumnId !== "all" && mobileColumnId !== col.id;

                      return (
                        <Droppable key={col.id} droppableId={col.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex flex-col bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl p-3 border border-slate-200/60 dark:border-slate-800/80 min-h-[400px] md:min-h-[600px] transition-colors ${
                                isHiddenOnMobile ? "hidden md:flex" : "flex"
                              } ${
                                snapshot.isDraggingOver
                                  ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300"
                                  : ""
                              }`}
                            >
                            {/* Column Header */}
                            <div
                              className="flex items-center justify-between pb-3 px-1 border-t-2"
                              style={{ borderColor: col.color || "#6366f1" }}
                            >
                              <div className="flex items-center gap-2 pt-2">
                                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                  {col.title}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {columnTasks.length}
                                </span>
                              </div>

                              <button
                                onClick={() => openCreateModal(col.id)}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 transition pt-2"
                                title="Add task in this column"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Task List */}
                            <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                              {columnTasks.map((task, index) => {
                                const checklistCount = task.checklist?.length || 0;
                                const completedChecklist =
                                  task.checklist?.filter((c) => c.completed).length || 0;

                                return (
                                  <Draggable
                                    key={task._id}
                                    draggableId={task._id}
                                    index={index}
                                  >
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        onClick={() => openEditModal(task)}
                                        className={`group relative p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-2.5 ${
                                          task.isBlocked && col.category !== "done"
                                            ? "border-red-400 dark:border-red-500/80 bg-red-50/20 dark:bg-red-950/20"
                                            : ""
                                        } ${
                                          snapshot.isDragging
                                            ? "shadow-2xl ring-2 ring-indigo-500 scale-102"
                                            : ""
                                        }`}
                                      >
                                        {/* Task Top Meta: Priority & Status Badges */}
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <PriorityBadge priority={task.priority} />
                                            {task.isBlocked && col.category !== "done" && (
                                              <span
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300"
                                                title="Blocked by incomplete dependency"
                                              >
                                                <ShieldAlert className="w-3 h-3" /> BLOCKED
                                              </span>
                                            )}
                                          </div>

                                          {task.dueDate && (
                                            <div
                                              className={`flex items-center gap-1 text-[10px] font-medium ${
                                                new Date(task.dueDate) < new Date() && col.category !== "done"
                                                  ? "text-red-500 font-bold"
                                                  : "text-slate-400"
                                              }`}
                                            >
                                              <Calendar className="w-3 h-3" />
                                              <span>
                                                {new Date(task.dueDate).toLocaleDateString(
                                                  undefined,
                                                  { month: "short", day: "numeric" }
                                                )}
                                              </span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Task Title */}
                                        <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                                          {task.title}
                                        </h4>

                                        {/* Labels */}
                                        {task.labels?.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {task.labels.map((lbl, i) => (
                                              <span
                                                key={i}
                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium text-white shadow-2xs"
                                                style={{
                                                  backgroundColor: lbl.color || "#6366f1",
                                                }}
                                              >
                                                {lbl.name}
                                              </span>
                                            ))}
                                          </div>
                                        )}

                                        {/* Progress Indicators & Subtasks */}
                                        <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/40">
                                          {task.totalSubtasks > 0 && (
                                            <div
                                              className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium"
                                              title="Subtasks progress"
                                            >
                                              <CornerDownRight className="w-3 h-3" />
                                              <span>
                                                {task.completedSubtasks}/{task.totalSubtasks}
                                              </span>
                                            </div>
                                          )}

                                          {checklistCount > 0 && (
                                            <div className="flex items-center gap-1">
                                              <CheckSquare className="w-3 h-3 text-indigo-500" />
                                              <span>
                                                {completedChecklist}/{checklistCount}
                                              </span>
                                            </div>
                                          )}

                                          {task.estimatedHours && (
                                            <div className="flex items-center gap-1">
                                              <Clock className="w-3 h-3 text-slate-400" />
                                              <span>{task.estimatedHours}h</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Footer Row: Assignees & Quick Delete */}
                                        <div className="flex items-center justify-between pt-1">
                                          <div className="flex -space-x-1.5 overflow-hidden">
                                            {task.assignedTo?.map((u, i) => (
                                              <div
                                                key={u._id || i}
                                                className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-indigo-500 text-white text-[10px] flex items-center justify-center font-bold uppercase"
                                                title={u.name}
                                              >
                                                {u.name?.charAt(0) || "U"}
                                              </div>
                                            ))}
                                          </div>

                                          <button
                                            onClick={(e) => deleteTask(e, task._id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition"
                                            title="Delete Task"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          </div>
                        )}
                      </Droppable>
                    );
                  })}
                </div>
              </DragDropContext>
            </div>
            )}
          </div>
        )}

        {activeTab === "activity" && <ActivityPanel projectId={projectId} />}
        {activeTab === "chat" && <ChatPanel projectId={projectId} />}
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        initialTask={editingTask}
        defaultStatus={createStatus}
        defaultSprintId={selectedSprintId !== "all" && selectedSprintId !== "backlog" ? selectedSprintId : ""}
        onSaved={handleTaskSaved}
      />

      <TaskTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        projectId={projectId}
        onTemplateCreated={() => {
          fetchTasks();
        }}
      />

      <SprintModal
        open={sprintModalOpen}
        onClose={() => setSprintModalOpen(false)}
        projectId={projectId}
        initialSprint={editingSprint}
        onSaved={() => {
          fetchSprints();
        }}
      />
      <MilestoneModal
        open={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
        projectId={projectId}
        initialMilestone={editingMilestone}
        onSaved={() => {
          fetchMilestones();
          fetchTasks();
        }}
      />
      <WorkflowModal
        open={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        projectId={projectId}
        workflow={workflow}
        onSaved={(updatedWf) => {
          setWorkflow(updatedWf);
          fetchTasks();
        }}
      />
      <AutomationModal
        open={automationModalOpen}
        onClose={() => setAutomationModalOpen(false)}
        projectId={projectId}
        workflowStatuses={boardColumns.map((c) => ({ key: c.id, name: c.title }))}
        members={members}
        onChanged={() => {
          fetchTasks();
        }}
      />
    </div>
  );
}

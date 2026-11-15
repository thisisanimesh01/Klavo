import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskModal from "../components/TaskModal";
import TaskTemplateModal from "../components/TaskTemplateModal";
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
} from "lucide-react";

const COLUMNS = [
  { id: "todo", title: "Todo", border: "border-t-slate-400" },
  { id: "in-progress", title: "In Progress", border: "border-t-blue-500" },
  { id: "review", title: "In Review", border: "border-t-amber-500" },
  { id: "done", title: "Done", border: "border-t-emerald-500" },
];

export default function Kanban() {
  const { projectId } = useParams();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [createStatus, setCreateStatus] = useState("todo");

  const [activeTab, setActiveTab] = useState("board");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedLabel, setSelectedLabel] = useState("all");
  const [selectedAssignee, setSelectedAssignee] = useState("all");
  const [sortBy, setSortBy] = useState("order"); // 'order', 'dueDate', 'priority', 'createdAt'

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

  useEffect(() => {
    if (projectId) fetchTasks();
  }, [projectId, fetchTasks]);

  useEffect(() => {
    if (!projectId) return;
    if (!socket.connected) socket.connect();

    socket.emit("joinProject", { projectId });

    const created = (task) => {
      if (String(task.projectId) === String(projectId)) {
        setTasks((prev) =>
          prev.some((t) => t._id === task._id) ? prev : [...prev, task]
        );
      }
    };

    const updated = (task) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    };

    const moved = (task) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    };

    const deleted = ({ _id }) => {
      setTasks((prev) => prev.filter((t) => t._id !== _id));
    };

    socket.on("taskCreated", created);
    socket.on("taskUpdated", updated);
    socket.on("taskMoved", moved);
    socket.on("taskDeleted", deleted);

    return () => {
      socket.emit("leaveProject", { projectId });
      socket.off("taskCreated", created);
      socket.off("taskUpdated", updated);
      socket.off("taskMoved", moved);
      socket.off("taskDeleted", deleted);
    };
  }, [projectId]);

  // Extract unique labels and assignees for filter dropdowns
  const availableLabels = useMemo(() => {
    const labelSet = new Set();
    tasks.forEach((t) => {
      if (Array.isArray(t.labels)) {
        t.labels.forEach((l) => labelSet.add(l.name));
      }
    });
    return Array.from(labelSet).sort();
  }, [tasks]);

  const availableAssignees = useMemo(() => {
    const assigneeMap = new Map();
    tasks.forEach((t) => {
      if (Array.isArray(t.assignedTo)) {
        t.assignedTo.forEach((u) => {
          if (u && u._id) assigneeMap.set(u._id, u.name);
        });
      }
    });
    return Array.from(assigneeMap.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  // Priority weight for sorting
  const priorityWeight = {
    urgent: 5,
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(query);
        const matchesDesc = t.description?.toLowerCase().includes(query);
        const matchesLabel = t.labels?.some((l) => l.name.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDesc && !matchesLabel) return false;
      }

      // Priority
      if (selectedPriority !== "all" && t.priority !== selectedPriority) {
        return false;
      }

      // Label
      if (selectedLabel !== "all") {
        const hasLabel = t.labels?.some(
          (l) => l.name.toLowerCase() === selectedLabel.toLowerCase()
        );
        if (!hasLabel) return false;
      }

      // Assignee
      if (selectedAssignee !== "all") {
        const hasAssignee = t.assignedTo?.some(
          (u) => (u._id || u) === selectedAssignee
        );
        if (!hasAssignee) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedPriority, selectedLabel, selectedAssignee]);

  const tasksByStatus = (status) =>
    filteredTasks
      .filter((t) => t.status === status)
      .sort((a, b) => {
        if (sortBy === "priority") {
          const pa = priorityWeight[a.priority] || 2;
          const pb = priorityWeight[b.priority] || 2;
          if (pa !== pb) return pb - pa;
        } else if (sortBy === "dueDate") {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        } else if (sortBy === "createdAt") {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        // Default order
        const ao = a.order ?? 0;
        const bo = b.order ?? 0;
        if (ao !== bo) return ao - bo;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

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
    } catch {
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

  const handleTaskSaved = () => {
    fetchTasks();
    setModalOpen(false);
  };

  const deleteTask = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await axiosClient.delete(`/tasks/${id}`);
      fetchTasks();
    } catch (err) {
      alert("Failed to delete task");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedPriority("all");
    setSelectedLabel("all");
    setSelectedAssignee("all");
    setSortBy("order");
  };

  const hasActiveFilters =
    searchQuery ||
    selectedPriority !== "all" ||
    selectedLabel !== "all" ||
    selectedAssignee !== "all" ||
    sortBy !== "order";

  if (loading) return <div className="p-6 text-slate-500">Loading Kanban board...</div>;

  return (
    <div className="min-h-screen app-bg p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Project Kanban
            </h1>
            <p className="text-xs text-slate-500">
              Interactive task board with real-time sync, priorities, and blueprints
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTemplateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
            >
              <LayoutTemplate className="w-4 h-4 text-indigo-600" />
              Templates
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
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
          {["board", "activity", "chat"].map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === tab
                  ? "border-b-2 border-indigo-600 text-indigo-600 font-semibold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "board" && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="app-card border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tasks, descriptions, or tags..."
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent text-xs focus:ring-2 focus:ring-indigo-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Priority filter */}
              <select
                className="border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-xs font-medium"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {/* Label filter */}
              {availableLabels.length > 0 && (
                <select
                  className="border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-xs font-medium"
                  value={selectedLabel}
                  onChange={(e) => setSelectedLabel(e.target.value)}
                >
                  <option value="all">All Labels</option>
                  {availableLabels.map((lbl) => (
                    <option key={lbl} value={lbl}>
                      Tag: {lbl}
                    </option>
                  ))}
                </select>
              )}

              {/* Assignee filter */}
              {availableAssignees.length > 0 && (
                <select
                  className="border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-xs font-medium"
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                >
                  <option value="all">All Assignees</option>
                  {availableAssignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Sort selector */}
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  className="border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-xs font-medium"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="order">Custom Order</option>
                  <option value="priority">Priority (High-to-Low)</option>
                  <option value="dueDate">Due Date</option>
                  <option value="createdAt">Date Created</option>
                </select>
              </div>

              {/* Clear filters button */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 font-medium rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <X className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
            </div>

            {/* Drag & Drop Board */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {COLUMNS.map((col) => {
                  const colTasks = tasksByStatus(col.id);
                  return (
                    <Droppable key={col.id} droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`app-card border border-slate-200 dark:border-slate-800 border-t-4 ${col.border} rounded-2xl p-3 min-h-[450px] shadow-sm flex flex-col transition ${
                            snapshot.isDraggingOver
                              ? "bg-indigo-50/20 dark:bg-indigo-950/20"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-2">
                              <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                {col.title}
                              </h2>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                                {colTasks.length}
                              </span>
                            </div>
                            <button
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={() => openCreateModal(col.id)}
                              title="Add Task"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex-1 space-y-2.5 overflow-y-auto">
                            {colTasks.map((task, index) => {
                              const checklistCount = task.checklist?.length || 0;
                              const completedChecklist =
                                task.checklist?.filter((i) => i.completed)?.length || 0;

                              return (
                                <Draggable
                                  key={task._id}
                                  draggableId={task._id}
                                  index={index}
                                >
                                  {(prov, dragSnap) => (
                                    <div
                                      ref={prov.innerRef}
                                      {...prov.draggableProps}
                                      {...prov.dragHandleProps}
                                      onClick={() => openEditModal(task)}
                                      className={`p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition cursor-pointer space-y-2 group ${
                                        dragSnap.isDragging
                                          ? "ring-2 ring-indigo-500 rotate-1 shadow-lg"
                                          : ""
                                      }`}
                                    >
                                      {/* Top Row: Priority & Template Tag */}
                                      <div className="flex items-center justify-between gap-2">
                                        <PriorityBadge priority={task.priority} />
                                        {task.templateId && (
                                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                            <LayoutTemplate className="w-3 h-3 text-indigo-500" />
                                            {task.templateId.name || "Template"}
                                          </span>
                                        )}
                                      </div>

                                      {/* Task Title */}
                                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-snug">
                                        {task.title}
                                      </h3>

                                      {/* Labels */}
                                      {task.labels?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                          {task.labels.map((lbl, i) => (
                                            <span
                                              key={i}
                                              className="inline-block px-2 py-0.5 rounded text-[10px] font-medium text-white shadow-xs"
                                              style={{ backgroundColor: lbl.color || "#6366f1" }}
                                            >
                                              {lbl.name}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Metadata Row: Due Date, Checklist, Custom Fields */}
                                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                        {task.dueDate && (
                                          <div
                                            className={`flex items-center gap-1 ${
                                              new Date(task.dueDate) < new Date() && task.status !== "done"
                                                ? "text-red-500 font-semibold"
                                                : ""
                                            }`}
                                          >
                                            <Calendar className="w-3 h-3" />
                                            <span>
                                              {new Date(task.dueDate).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                              })}
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

        {activeTab === "activity" && <ActivityPanel projectId={projectId} />}
        {activeTab === "chat" && <ChatPanel projectId={projectId} />}
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        initialTask={editingTask}
        defaultStatus={createStatus}
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
    </div>
  );
}

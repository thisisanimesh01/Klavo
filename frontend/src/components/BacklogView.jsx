import React, { useState, useMemo } from "react";
import axiosClient from "../api/axiosClient";
import PriorityBadge from "./PriorityBadge";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Layers,
  Zap,
  Plus,
  Search,
  ArrowUpDown,
  Filter,
  CheckSquare,
  Clock,
  Calendar,
  AlertTriangle,
  MoveRight,
  Trash2,
  Tag,
  CheckCircle2,
  GripVertical,
  ShieldAlert,
  CornerDownRight,
} from "lucide-react";

export default function BacklogView({
  projectId,
  tasks = [],
  sprints = [],
  onTasksUpdated,
  onOpenCreateTask,
  onOpenEditTask,
  onOpenCreateSprint,
}) {
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [targetSprintId, setTargetSprintId] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Group tasks into Backlog (sprintId === null) and Active/Planned Sprints
  const backlogTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.sprintId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tasks]);

  const activeOrPlannedSprints = useMemo(() => {
    return sprints.filter((s) => s.status === "active" || s.status === "planned");
  }, [sprints]);

  // Filter backlog tasks based on search & priority
  const filteredBacklogTasks = useMemo(() => {
    return backlogTasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesTag = t.labels?.some((l) => l.name.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesTag) return false;
      }
      if (selectedPriority !== "all" && t.priority !== selectedPriority) {
        return false;
      }
      return true;
    });
  }, [backlogTasks, searchQuery, selectedPriority]);

  // Total backlog stats
  const totalBacklogHours = useMemo(() => {
    return filteredBacklogTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  }, [filteredBacklogTasks]);

  // Bulk selection toggles
  const handleToggleSelectTask = (taskId) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAllBacklog = () => {
    if (selectedTaskIds.length === filteredBacklogTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredBacklogTasks.map((t) => t._id));
    }
  };

  // Bulk Move Actions
  const handleBulkMoveToSprint = async () => {
    if (selectedTaskIds.length === 0 || !targetSprintId) return;

    try {
      setBulkUpdating(true);
      await axiosClient.post("/tasks/bulk", {
        taskIds: selectedTaskIds,
        updates: { sprintId: targetSprintId === "backlog" ? null : targetSprintId },
        projectId,
      });

      setSelectedTaskIds([]);
      setTargetSprintId("");
      if (onTasksUpdated) onTasksUpdated();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to move tasks");
    } finally {
      setBulkUpdating(false);
    }
  };

  // Drag-and-drop reordering for Backlog priority ranking
  const handleDragEnd = async (result) => {
    const { destination, source } = result;
    if (!destination) return;
    if (destination.index === source.index) return;

    const reordered = Array.from(filteredBacklogTasks);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    const taskOrderList = reordered.map((t, idx) => ({
      taskId: t._id,
      order: idx,
    }));

    try {
      await axiosClient.put("/tasks/reorder", {
        taskOrderList,
        projectId,
      });
      if (onTasksUpdated) onTasksUpdated();
    } catch (err) {
      console.error("Reorder failed:", err);
      if (onTasksUpdated) onTasksUpdated();
    }
  };

  return (
    <div className="space-y-6">
      {/* Sprints Overview with Capacity & Overload Meter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            Sprint Capacities & Iteration Workloads
          </h2>
          <button
            onClick={onOpenCreateSprint}
            className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
          >
            + Create Sprint
          </button>
        </div>

        {activeOrPlannedSprints.length === 0 ? (
          <div className="p-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-400">
            No active or planned sprints. Create a sprint to begin scheduling items from the product backlog.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrPlannedSprints.map((sprint) => {
              const sprintTasks = tasks.filter((t) => {
                const sId = t.sprintId?._id || t.sprintId;
                return sId === sprint._id;
              });

              const committedHours = sprintTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
              const capacity = sprint.capacity || null;
              const isOverloaded = capacity !== null && committedHours > capacity;
              const utilization = capacity !== null && capacity > 0 ? Math.round((committedHours / capacity) * 100) : null;

              return (
                <div
                  key={sprint._id}
                  className={`app-card border rounded-2xl p-4 shadow-sm transition space-y-3 ${
                    isOverloaded
                      ? "border-red-300 dark:border-red-900 bg-red-50/20 dark:bg-red-950/20"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        sprint.status === "active"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}>
                        {sprint.status}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                        {sprint.name}
                      </h3>
                    </div>
                    {isOverloaded && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-red-500 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900 animate-pulse">
                        <AlertTriangle className="w-3 h-3" /> Overloaded
                      </span>
                    )}
                  </div>

                  {sprint.goal && (
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {sprint.goal}
                    </p>
                  )}

                  {/* Capacity Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Committed Effort:</span>
                      <span className={`font-semibold ${isOverloaded ? "text-red-600 font-bold" : "text-slate-800 dark:text-slate-200"}`}>
                        {committedHours}h {capacity ? `/ ${capacity}h max` : "(No limit)"}
                      </span>
                    </div>

                    {capacity && (
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isOverloaded
                              ? "bg-red-500"
                              : utilization > 80
                              ? "bg-amber-500"
                              : "bg-indigo-600"
                          }`}
                          style={{ width: `${Math.min(utilization || 0, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>{sprintTasks.length} tasks assigned</span>
                    {sprint.endDate && (
                      <span>Ends {new Date(sprint.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Backlog Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              Product Backlog ({filteredBacklogTasks.length} items • {totalBacklogHours}h estimated)
            </h2>
            <p className="text-xs text-slate-500">
              Rank items by priority via drag and drop. Move selected batches directly into sprint iterations.
            </p>
          </div>

          <button
            onClick={() => onOpenCreateTask("todo")}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add Backlog Item
          </button>
        </div>

        {/* Backlog Filter & Bulk Action Toolbar */}
        <div className="app-card border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search backlog..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Priority Filter */}
            <select
              className="border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-xs"
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
          </div>

          {/* Bulk Actions */}
          {selectedTaskIds.length > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/60 p-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 px-2">
                {selectedTaskIds.length} selected
              </span>

              <select
                className="border border-indigo-300 dark:border-indigo-800 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 text-xs font-medium"
                value={targetSprintId}
                onChange={(e) => setTargetSprintId(e.target.value)}
              >
                <option value="">Choose Target Sprint...</option>
                {activeOrPlannedSprints.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>

              <button
                onClick={handleBulkMoveToSprint}
                disabled={!targetSprintId || bulkUpdating}
                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition"
              >
                <MoveRight className="w-3.5 h-3.5" /> Move
              </button>
            </div>
          )}
        </div>

        {/* Backlog List with Drag & Drop */}
        <div className="app-card border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm overflow-x-auto">
          <div className="min-w-[640px] md:min-w-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded text-indigo-600 cursor-pointer min-w-[16px] min-h-[16px]"
                  checked={
                    filteredBacklogTasks.length > 0 &&
                    selectedTaskIds.length === filteredBacklogTasks.length
                  }
                  onChange={handleSelectAllBacklog}
                />
                <span>RANK & TITLE</span>
              </div>
              <div className="flex items-center gap-8">
                <span>PRIORITY</span>
                <span>ESTIMATE</span>
                <span>DUE DATE</span>
              </div>
            </div>

            {filteredBacklogTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No items in the backlog. Click "Add Backlog Item" to create tasks.
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="backlog-items">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="divide-y divide-slate-100 dark:divide-slate-800/80"
                    >
                      {filteredBacklogTasks.map((task, index) => {
                        const isSelected = selectedTaskIds.includes(task._id);

                        return (
                          <Draggable
                            key={task._id}
                            draggableId={task._id}
                            index={index}
                          >
                            {(prov, snapshot) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                className={`py-3 px-2 flex items-center justify-between gap-4 text-xs transition rounded-xl ${
                                  snapshot.isDragging
                                    ? "bg-indigo-50 dark:bg-indigo-950/80 shadow-md ring-1 ring-indigo-500"
                                    : isSelected
                                    ? "bg-indigo-50/40 dark:bg-indigo-950/30"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                }`}
                              >
                                {/* Left: Drag Handle, Select, Title */}
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div
                                    {...prov.dragHandleProps}
                                    className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-1.5"
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </div>

                                  <input
                                    type="checkbox"
                                    className="rounded text-indigo-600 cursor-pointer min-w-[16px] min-h-[16px]"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectTask(task._id)}
                                  />

                                  <span className="font-mono text-slate-400 text-[11px] w-6 text-right shrink-0">
                                    #{index + 1}
                                  </span>

                                  <div
                                    onClick={() => onOpenEditTask(task)}
                                    className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100 truncate hover:text-indigo-600"
                                  >
                                    {task.title}
                                  </div>

                                  {task.labels?.map((lbl, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 rounded text-[10px] font-medium text-white shadow-xs shrink-0 hidden sm:inline-block"
                                      style={{ backgroundColor: lbl.color || "#6366f1" }}
                                    >
                                      {lbl.name}
                                    </span>
                                  ))}
                                </div>

                                {/* Right: Priority, Estimate, Due Date */}
                                <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                                  <div className="flex items-center gap-1.5">
                                    <PriorityBadge priority={task.priority} />
                                    {task.isBlocked && task.status !== "done" && (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300"
                                        title="Blocked by incomplete dependency"
                                      >
                                        <ShieldAlert className="w-3 h-3" /> BLOCKED
                                      </span>
                                    )}
                                    {task.totalSubtasks > 0 && (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
                                        title="Subtask progress"
                                      >
                                        <CornerDownRight className="w-3 h-3" /> {task.completedSubtasks}/{task.totalSubtasks}
                                      </span>
                                    )}
                                  </div>

                                  <div className="w-14 sm:w-16 text-right font-medium text-slate-600 dark:text-slate-300">
                                    {task.estimatedHours ? `${task.estimatedHours}h` : "—"}
                                  </div>

                                  <div className="w-20 sm:w-24 text-right text-slate-400">
                                    {task.dueDate
                                      ? new Date(task.dueDate).toLocaleDateString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                        })
                                      : "—"}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

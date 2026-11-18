import React, { useState, useMemo } from "react";
import axiosClient from "../api/axiosClient";
import PriorityBadge from "./PriorityBadge";
import {
  Calendar,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Zap,
  Filter,
  Plus,
  ArrowRight,
  GitCommit,
  CheckSquare,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
} from "lucide-react";

export default function GanttTimelineView({
  projectId,
  milestones = [],
  tasks = [],
  sprints = [],
  onOpenCreateMilestone,
  onOpenEditMilestone,
  onOpenEditTask,
  onRefresh,
}) {
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("all");
  const [selectedSprintId, setSelectedSprintId] = useState("all");
  const [expandedMilestones, setExpandedMilestones] = useState({});
  const [timeScale, setTimeScale] = useState("weeks"); // "days" | "weeks" | "months"

  const toggleMilestoneExpand = (mId) => {
    setExpandedMilestones((prev) => ({
      ...prev,
      [mId]: !prev[mId],
    }));
  };

  // Filter tasks based on selected milestone and sprint
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedMilestoneId !== "all") {
        const mId = t.milestoneId?._id || t.milestoneId;
        if (selectedMilestoneId === "none" && mId) return false;
        if (selectedMilestoneId !== "none" && mId !== selectedMilestoneId) return false;
      }
      if (selectedSprintId !== "all") {
        const sId = t.sprintId?._id || t.sprintId;
        if (selectedSprintId === "backlog" && sId) return false;
        if (selectedSprintId !== "backlog" && sId !== selectedSprintId) return false;
      }
      return true;
    });
  }, [tasks, selectedMilestoneId, selectedSprintId]);

  // Determine overall timeline date span
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    let minDate = new Date();
    let maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30); // default 30 days window

    const dates = [];

    milestones.forEach((m) => {
      if (m.startDate) dates.push(new Date(m.startDate));
      if (m.dueDate) dates.push(new Date(m.dueDate));
    });

    tasks.forEach((t) => {
      if (t.createdAt) dates.push(new Date(t.createdAt));
      if (t.dueDate) dates.push(new Date(t.dueDate));
    });

    if (dates.length > 0) {
      const timestamps = dates.map((d) => d.getTime()).filter((t) => !isNaN(t));
      if (timestamps.length > 0) {
        minDate = new Date(Math.min(...timestamps));
        maxDate = new Date(Math.max(...timestamps));
      }
    }

    // Pad start by -3 days and end by +7 days
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 7);

    // Normalize to midnight
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(23, 59, 59, 999);

    const diffMs = maxDate.getTime() - minDate.getTime();
    const days = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 14);

    return { timelineStart: minDate, timelineEnd: maxDate, totalDays: days };
  }, [milestones, tasks]);

  // Compute horizontal percentage position & width
  const computeBarPosition = (start, end) => {
    const s = start ? new Date(start) : timelineStart;
    let e = end ? new Date(end) : new Date(s);
    if (!end || e < s) {
      e = new Date(s);
      e.setDate(e.getDate() + 2); // minimum 2-day visual length
    }

    const startOffsetMs = Math.max(0, s.getTime() - timelineStart.getTime());
    const durationMs = Math.max(1000 * 60 * 60 * 24, e.getTime() - s.getTime());
    const totalMs = timelineEnd.getTime() - timelineStart.getTime();

    const leftPercent = Math.min(Math.max((startOffsetMs / totalMs) * 100, 0), 98);
    const widthPercent = Math.min(Math.max((durationMs / totalMs) * 100, 2), 100 - leftPercent);

    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
  };

  const now = new Date();
  const todayPosition = useMemo(() => {
    const offsetMs = now.getTime() - timelineStart.getTime();
    const totalMs = timelineEnd.getTime() - timelineStart.getTime();
    const pct = (offsetMs / totalMs) * 100;
    return pct >= 0 && pct <= 100 ? `${pct}%` : null;
  }, [timelineStart, timelineEnd, now]);

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Controls */}
      <div className="app-card border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
            <Flag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Project Milestones & Gantt Timeline
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold">
                {milestones.length} Milestones
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Interactive timeline view with date ranges, progress fills, overdue warnings, and dependency linkages
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Milestone Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Milestone:</span>
            <select
              value={selectedMilestoneId}
              onChange={(e) => setSelectedMilestoneId(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="all">All Milestones</option>
              {milestones.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
              <option value="none">No Milestone Assigned</option>
            </select>
          </div>

          {/* Sprint Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Sprint:</span>
            <select
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="all">All Sprints</option>
              {sprints.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
              <option value="backlog">Product Backlog Only</option>
            </select>
          </div>

          <button
            onClick={onOpenCreateMilestone}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Milestone</span>
          </button>
        </div>
      </div>

      {/* Main Gantt Grid Chart */}
      <div className="app-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-x-auto">
        <div className="min-w-[700px] md:min-w-0">
          {/* Timeline Header Date Bar */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold text-slate-500">
            <div className="w-56 sm:w-72 shrink-0 p-3 border-r border-slate-200 dark:border-slate-800">
              Milestone / Task Name
            </div>
            <div className="flex-1 relative p-3 overflow-hidden">
              <div className="flex justify-between items-center text-slate-400">
                <span>{timelineStart.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  Today: {now.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span>{timelineEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </div>
          </div>

        {/* Milestone Rows & Nested Tasks */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {milestones.length === 0 && tasks.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Flag className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">No milestones or tasks found</p>
              <p className="text-xs text-slate-500">Create your first milestone or assign tasks to begin timeline planning.</p>
            </div>
          ) : (
            milestones.map((m) => {
              const mTasks = filteredTasks.filter(
                (t) => (t.milestoneId?._id || t.milestoneId)?.toString() === m._id.toString()
              );
              const isExpanded = expandedMilestones[m._id] ?? true;
              const pos = computeBarPosition(m.startDate, m.dueDate);
              const isOverdue = Boolean(m.dueDate && new Date(m.dueDate) < now && m.status !== "completed");

              return (
                <div key={m._id} className="group">
                  {/* Milestone Header Row */}
                  <div className="flex items-center hover:bg-slate-50/60 dark:hover:bg-slate-850/40 transition">
                    {/* Left Column: Milestone Info */}
                    <div className="w-72 shrink-0 p-3 flex items-center justify-between gap-2 border-r border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => toggleMilestoneExpand(m._id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <Flag className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span
                          onClick={() => onOpenEditMilestone(m)}
                          className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:text-indigo-600"
                        >
                          {m.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold">
                          {m.progress || 0}%
                        </span>
                        {isOverdue && (
                          <span title="Milestone Overdue" className="text-red-500">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Timeline Bar */}
                    <div className="flex-1 relative h-12 flex items-center px-2">
                      {/* Today vertical marker line */}
                      {todayPosition && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-400 z-10 opacity-70 pointer-events-none"
                          style={{ left: todayPosition }}
                        />
                      )}

                      {/* Milestone Bar */}
                      <div
                        className="absolute h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-400/60 dark:border-indigo-700 flex items-center px-2 overflow-hidden shadow-xs cursor-pointer hover:ring-2 hover:ring-indigo-500 transition"
                        style={{ left: pos.left, width: pos.width }}
                        onClick={() => onOpenEditMilestone(m)}
                        title={`${m.name} (${m.progress || 0}% complete)`}
                      >
                        {/* Progress Fill */}
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-indigo-600/30 transition-all"
                          style={{ width: `${m.progress || 0}%` }}
                        />
                        <span className="relative z-10 text-[10px] font-bold text-indigo-900 dark:text-indigo-200 truncate">
                          {m.name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Nested Tasks under this Milestone */}
                  {isExpanded &&
                    mTasks.map((task) => {
                      const taskPos = computeBarPosition(task.createdAt, task.dueDate);
                      const isTaskOverdue = Boolean(task.dueDate && new Date(task.dueDate) < now && task.status !== "done");
                      const isBlocked = task.isBlocked;

                      return (
                        <div
                          key={task._id}
                          className="flex items-center bg-slate-50/30 dark:bg-slate-900/30 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 text-xs transition"
                        >
                          {/* Task Left Column */}
                          <div className="w-72 shrink-0 p-2.5 pl-8 flex items-center justify-between gap-2 border-r border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2 min-w-0">
                              <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span
                                onClick={() => onOpenEditTask(task)}
                                className="font-medium text-xs text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-indigo-600"
                              >
                                {task.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isBlocked && task.status !== "done" && (
                                <span className="text-red-500" title="Blocked by dependency">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <PriorityBadge priority={task.priority} />
                            </div>
                          </div>

                          {/* Task Timeline Bar */}
                          <div className="flex-1 relative h-9 flex items-center px-2">
                            {todayPosition && (
                              <div
                                className="absolute top-0 bottom-0 w-px bg-red-400 z-10 opacity-70 pointer-events-none"
                                style={{ left: todayPosition }}
                              />
                            )}

                            <div
                              onClick={() => onOpenEditTask(task)}
                              className={`absolute h-4 rounded-md border flex items-center px-1.5 overflow-hidden shadow-xs cursor-pointer transition text-[9px] font-medium ${
                                task.status === "done"
                                  ? "bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200"
                                  : isTaskOverdue
                                  ? "bg-red-100 border-red-400 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
                                  : isBlocked
                                  ? "bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200"
                                  : "bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200"
                              }`}
                              style={{ left: taskPos.left, width: taskPos.width }}
                              title={`${task.title} (${task.status})`}
                            >
                              <span className="truncate">{task.title}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

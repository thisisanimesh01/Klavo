import React, { useState } from "react";
import {
  Search,
  Filter,
  SlidersHorizontal,
  X,
  Calendar,
  AlertTriangle,
  Tag,
  User,
  Zap,
  Flag,
  ArrowUpDown,
  Layers,
  ChevronDown,
} from "lucide-react";

export default function AdvancedFilterBar({
  searchQuery,
  onSearchChange,
  selectedPriorities = [],
  onPrioritiesChange,
  selectedStatuses = [],
  onStatusesChange,
  selectedAssignee,
  onAssigneeChange,
  selectedLabel,
  onLabelChange,
  selectedSprintId,
  onSprintChange,
  selectedMilestoneId,
  onMilestoneChange,
  dueDateFilter,
  onDueDateFilterChange,
  dependencyFilter,
  onDependencyFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  groupBy,
  onGroupByChange,
  onResetFilters,
  // Context options
  workflowStatuses = [],
  sprints = [],
  milestones = [],
  members = [],
  availableLabels = [],
}) {
  const [expanded, setExpanded] = useState(false);

  // Active filters count
  const activeFiltersCount =
    (searchQuery ? 1 : 0) +
    (selectedPriorities.length > 0 ? 1 : 0) +
    (selectedStatuses.length > 0 ? 1 : 0) +
    (selectedAssignee !== "all" ? 1 : 0) +
    (selectedLabel !== "all" ? 1 : 0) +
    (selectedSprintId !== "all" ? 1 : 0) +
    (selectedMilestoneId !== "all" ? 1 : 0) +
    (dueDateFilter !== "all" ? 1 : 0) +
    (dependencyFilter !== "all" ? 1 : 0) +
    (groupBy !== "none" ? 1 : 0);

  const togglePriority = (p) => {
    if (selectedPriorities.includes(p)) {
      onPrioritiesChange(selectedPriorities.filter((item) => item !== p));
    } else {
      onPrioritiesChange([...selectedPriorities, p]);
    }
  };

  const toggleStatus = (s) => {
    if (selectedStatuses.includes(s)) {
      onStatusesChange(selectedStatuses.filter((item) => item !== s));
    } else {
      onStatusesChange([...selectedStatuses, s]);
    }
  };

  return (
    <div className="space-y-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
      {/* Primary Row: Search Bar, Quick Toggles, Expand Filters, Sort, Group */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks by title, description, or label..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sprint Quick Select */}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <select
            value={selectedSprintId}
            onChange={(e) => onSprintChange(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Sprints</option>
            <option value="backlog">Product Backlog</option>
            {sprints.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
        </div>

        {/* Assignee Quick Select */}
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedAssignee}
            onChange={(e) => onAssigneeChange(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Assignees</option>
            <option value="me">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By Select & Direction */}
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="text-xs py-1.5 px-2 rounded-l-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="order">Manual Order</option>
            <option value="priority">Priority</option>
            <option value="dueDate">Due Date</option>
            <option value="createdAt">Created Date</option>
            <option value="updatedAt">Last Updated</option>
            <option value="title">Title</option>
            <option value="estimatedHours">Estimate</option>
          </select>
          <button
            onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
            className="text-xs py-1.5 px-2 rounded-r-xl border-y border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold uppercase"
            title={`Sort direction: ${sortOrder}`}
          >
            {sortOrder}
          </button>
        </div>

        {/* Group By Selector */}
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="none">Group: None</option>
            <option value="status">Group by Status</option>
            <option value="priority">Group by Priority</option>
            <option value="assignee">Group by Assignee</option>
            <option value="milestone">Group by Milestone</option>
          </select>
        </div>

        {/* Expand / Collapse Filters Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl border transition font-medium ${
            activeFiltersCount > 0 || expanded
              ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
              : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
              {activeFiltersCount}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        {activeFiltersCount > 0 && (
          <button
            onClick={onResetFilters}
            className="text-xs text-red-500 hover:text-red-700 hover:underline font-medium"
          >
            Reset
          </button>
        )}
      </div>

      {/* Expanded Filter Panel */}
      {expanded && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* Priorities Multi-Select Chips */}
          <div className="space-y-1.5">
            <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
              Priority
            </span>
            <div className="flex flex-wrap gap-1">
              {["low", "medium", "high", "critical", "urgent"].map((p) => {
                const isSelected = selectedPriorities.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePriority(p)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium capitalize transition ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Multi-Select Chips */}
          <div className="space-y-1.5">
            <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
              Workflow Status
            </span>
            <div className="flex flex-wrap gap-1">
              {workflowStatuses.map((s) => {
                const isSelected = selectedStatuses.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleStatus(s.key)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Milestone & Label Filters */}
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                Milestone
              </span>
              <select
                value={selectedMilestoneId}
                onChange={(e) => onMilestoneChange(e.target.value)}
                className="w-full text-xs py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Milestones</option>
                <option value="none">No Milestone Assigned</option>
                {milestones.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                Label
              </span>
              <select
                value={selectedLabel}
                onChange={(e) => onLabelChange(e.target.value)}
                className="w-full text-xs py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Labels</option>
                {availableLabels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Dependency Filters */}
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                Due Date
              </span>
              <select
                value={dueDateFilter}
                onChange={(e) => onDueDateFilterChange(e.target.value)}
                className="w-full text-xs py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Due Dates</option>
                <option value="overdue">Overdue Only</option>
                <option value="today">Due Today</option>
                <option value="this_week">Due This Week</option>
                <option value="next_week">Due Next Week</option>
                <option value="no_due_date">No Due Date</option>
              </select>
            </div>

            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                Dependencies
              </span>
              <select
                value={dependencyFilter}
                onChange={(e) => onDependencyFilterChange(e.target.value)}
                className="w-full text-xs py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Tasks</option>
                <option value="blocked_only">Blocked Tasks Only</option>
                <option value="unblocked_only">Unblocked Tasks</option>
                <option value="has_dependencies">Has Dependencies</option>
                <option value="no_dependencies">No Dependencies</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import mongoose from "mongoose";
import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";
import Activity from "../models/Activity.js";
import Workflow from "../models/Workflow.js";
import { checkProjectAccess } from "../utils/authHelpers.js";
import { isStatusCompleted, getCompletedStatusKeys } from "../utils/workflowHelpers.js";

/**
 * Builds standard ISO start and end Date bounds from date range filter presets.
 * Supported presets: all, today, this_week, this_month, last_30_days, custom
 */
export const buildDateFilterRange = ({ range, startDate, endDate }, now = new Date()) => {
  if (!range || range === "all") {
    return null;
  }

  const currentDate = new Date(now);

  if (range === "today") {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "this_week") {
    // Week starting Sunday or Monday - let's set Sunday 00:00:00 to Saturday 23:59:59
    const day = currentDate.getDay();
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "this_month") {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (range === "last_30_days") {
    const start = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "custom") {
    if (!startDate && !endDate) return null;
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date("2099-12-31T23:59:59.999Z");
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return { start, end };
    }
  }

  return null;
};

/**
 * Computes comprehensive project analytics metrics in a pure, testable function.
 */
export const calculateProjectAnalyticsMetrics = ({
  project,
  workflow,
  tasks = [],
  teamMembers = [],
  recentActivities = [],
  dateRange = null,
  now = new Date(),
}) => {
  const effectiveWorkflow = workflow || { statuses: [] };
  const completedStatusKeys = new Set(getCompletedStatusKeys(effectiveWorkflow));

  // Filter tasks if dateRange is provided (matches task.createdAt or dueDate)
  let filteredTasks = tasks;
  if (dateRange && dateRange.start && dateRange.end) {
    const { start, end } = dateRange;
    filteredTasks = tasks.filter((t) => {
      const created = t.createdAt ? new Date(t.createdAt) : null;
      return created && created >= start && created <= end;
    });
  }

  const totalTasks = filteredTasks.length;
  const nowTime = now.getTime();

  let completedTasks = 0;
  let inProgressTasks = 0;
  let overdueTasks = 0;
  let unassignedTasks = 0;

  // Status map & workflow status metadata
  const statusCounts = {};
  // Initialize with workflow statuses if configured
  if (effectiveWorkflow.statuses && Array.isArray(effectiveWorkflow.statuses)) {
    effectiveWorkflow.statuses.forEach((s) => {
      statusCounts[s.key] = 0;
    });
  }

  // Priority counts
  const priorityCounts = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
    urgent: 0,
  };

  // Team member workload mapping
  const memberWorkloadMap = new Map();
  // Pre-seed with project team members
  teamMembers.forEach((member) => {
    const mId = member._id ? member._id.toString() : member.id ? member.id.toString() : String(member);
    memberWorkloadMap.set(mId, {
      userId: mId,
      name: member.name || "Member",
      email: member.email || "",
      avatar: member.avatar || null,
      total: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
    });
  });

  filteredTasks.forEach((t) => {
    const isDone = isStatusCompleted(t.status, effectiveWorkflow) || completedStatusKeys.has(t.status);
    if (isDone) {
      completedTasks += 1;
    } else {
      // In-progress or other active categories
      if (t.status === "in-progress" || t.status === "review" || t.status === "in_progress") {
        inProgressTasks += 1;
      }
      // Overdue check
      if (t.dueDate) {
        const dueTime = new Date(t.dueDate).getTime();
        if (dueTime < nowTime) {
          overdueTasks += 1;
        }
      }
    }

    // Status distribution
    const statusKey = t.status || "todo";
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;

    // Priority distribution
    const priorityKey = (t.priority || "medium").toLowerCase();
    if (priorityCounts[priorityKey] !== undefined) {
      priorityCounts[priorityKey] += 1;
    } else {
      priorityCounts[priorityKey] = (priorityCounts[priorityKey] || 0) + 1;
    }

    // Assignee distribution
    const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : [];
    if (assignees.length === 0) {
      unassignedTasks += 1;
    } else {
      assignees.forEach((assignee) => {
        const uId = assignee?._id
          ? assignee._id.toString()
          : typeof assignee === "object"
          ? String(assignee.id || assignee)
          : String(assignee);

        let userRecord = memberWorkloadMap.get(uId);
        if (!userRecord) {
          userRecord = {
            userId: uId,
            name: assignee?.name || "Team Member",
            email: assignee?.email || "",
            avatar: assignee?.avatar || null,
            total: 0,
            completed: 0,
            pending: 0,
            overdue: 0,
          };
          memberWorkloadMap.set(uId, userRecord);
        }

        userRecord.total += 1;
        if (isDone) {
          userRecord.completed += 1;
        } else {
          userRecord.pending += 1;
          if (t.dueDate && new Date(t.dueDate).getTime() < nowTime) {
            userRecord.overdue += 1;
          }
        }
      });
    }
  });

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Build statusDistribution array with name and color from workflow
  const statusDistribution = Object.entries(statusCounts).map(([key, count]) => {
    const wfStatus = effectiveWorkflow.statuses?.find((s) => s.key === key);
    return {
      _id: key,
      status: key,
      label: wfStatus?.name || (key.charAt(0).toUpperCase() + key.slice(1).replace("-", " ")),
      color: wfStatus?.color || (key === "done" ? "#10b981" : key === "in-progress" ? "#3b82f6" : key === "review" ? "#f59e0b" : "#94a3b8"),
      category: wfStatus?.category || (key === "done" ? "done" : "todo"),
      count,
    };
  });

  // Build priorityDistribution array
  const priorityColors = {
    low: "#94a3b8",
    medium: "#3b82f6",
    high: "#f59e0b",
    critical: "#ef4444",
    urgent: "#a855f7",
  };
  const priorityDistribution = Object.entries(priorityCounts).map(([priority, count]) => ({
    _id: priority,
    priority,
    label: priority.charAt(0).toUpperCase() + priority.slice(1),
    color: priorityColors[priority] || "#6366f1",
    count,
  }));

  // Workload array sorted by total tasks descending
  const teamWorkload = Array.from(memberWorkloadMap.values()).sort((a, b) => b.total - a.total);

  // Velocity / Task creation activity breakdown for charts (last 7 days or date series)
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const activityMap = new Map();
  filteredTasks.forEach((t) => {
    if (t.createdAt) {
      const d = new Date(t.createdAt);
      const dayNum = d.getDay() + 1; // 1=Sun .. 7=Sat
      activityMap.set(dayNum, (activityMap.get(dayNum) || 0) + 1);
    }
  });

  const weeklyActivity = [];
  for (let i = 1; i <= 7; i++) {
    weeklyActivity.push({
      _id: dayNames[i - 1],
      dayOfWeek: i,
      count: activityMap.get(i) || 0,
    });
  }

  // Key performance indicators
  const kpis = {
    completionRate,
    totalTasks,
    completedTasks,
    inProgressTasks,
    overdueTasks,
    unassignedTasks,
    workloadAssignedRate: totalTasks > 0 ? Math.round(((totalTasks - unassignedTasks) / totalTasks) * 100) : 0,
  };

  return {
    projectId: project?._id || project?.id,
    projectName: project?.name || "Project",
    projectDescription: project?.description || "",
    taskCount: totalTasks,
    completedCount: completedTasks,
    inProgressCount: inProgressTasks,
    overdueCount: overdueTasks,
    unassignedCount: unassignedTasks,
    completionRate,
    kpis,
    statusDistribution,
    priorityDistribution,
    teamWorkload,
    weeklyActivity,
    recentActivity: recentActivities.slice(0, 10),
  };
};

/**
 * Controller: GET /api/analytics/project/:projectId
 * Query params: range (all, today, this_week, this_month, last_30_days, custom), startDate, endDate
 */
export const getProjectAnalytics = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { range = "all", startDate, endDate } = req.query;

    const { hasAccess, project, team } = await checkProjectAccess(projectId, req.user._id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view analytics for this project",
      });
    }

    // Build date filter bounds
    const dateRange = buildDateFilterRange({ range, startDate, endDate });

    // Fetch project workflow to resolve custom statuses & completion semantics
    const workflow = await Workflow.findOne({ projectId });

    // Query tasks for this project
    const tasks = await Task.find({ projectId })
      .populate("assignedTo", "name email avatar")
      .select("title status priority dueDate assignedTo createdAt updatedAt");

    // Fetch team members for workload overview
    let teamMembers = [];
    if (team) {
      const fullTeam = await Team.findById(team._id)
        .populate("members", "name email avatar")
        .populate("owner", "name email avatar");
      if (fullTeam) {
        const uniqueMembers = new Map();
        if (fullTeam.owner) {
          uniqueMembers.set(fullTeam.owner._id.toString(), fullTeam.owner);
        }
        (fullTeam.members || []).forEach((m) => {
          if (m && m._id) {
            uniqueMembers.set(m._id.toString(), m);
          }
        });
        teamMembers = Array.from(uniqueMembers.values());
      }
    }

    // Fetch recent project activity
    const recentActivities = await Activity.find({ projectId })
      .populate("user", "name email avatar")
      .sort({ createdAt: -1 })
      .limit(10);

    const analytics = calculateProjectAnalyticsMetrics({
      project,
      workflow,
      tasks,
      teamMembers,
      recentActivities,
      dateRange,
      now: new Date(),
    });

    res.json({
      ...analytics,
      rangeApplied: range,
    });
  } catch (err) {
    console.error("Project Analytics Error:", err);
    res.status(500).json({ message: err.message });
  }
};

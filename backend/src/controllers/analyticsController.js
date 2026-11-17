import mongoose from "mongoose";
import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";
import Activity from "../models/Activity.js";
import Workflow from "../models/Workflow.js";
import Sprint from "../models/Sprint.js";
import { checkProjectAccess, checkSprintAccess } from "../utils/authHelpers.js";
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
 * Computes comprehensive project analytics metrics.
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

  const statusCounts = {};
  if (effectiveWorkflow.statuses && Array.isArray(effectiveWorkflow.statuses)) {
    effectiveWorkflow.statuses.forEach((s) => {
      statusCounts[s.key] = 0;
    });
  }

  const priorityCounts = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
    urgent: 0,
  };

  const memberWorkloadMap = new Map();
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
      if (t.status === "in-progress" || t.status === "review" || t.status === "in_progress") {
        inProgressTasks += 1;
      }
      if (t.dueDate) {
        const dueTime = new Date(t.dueDate).getTime();
        if (dueTime < nowTime) {
          overdueTasks += 1;
        }
      }
    }

    const statusKey = t.status || "todo";
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;

    const priorityKey = (t.priority || "medium").toLowerCase();
    if (priorityCounts[priorityKey] !== undefined) {
      priorityCounts[priorityKey] += 1;
    } else {
      priorityCounts[priorityKey] = (priorityCounts[priorityKey] || 0) + 1;
    }

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

  const teamWorkload = Array.from(memberWorkloadMap.values()).sort((a, b) => b.total - a.total);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const activityMap = new Map();
  filteredTasks.forEach((t) => {
    if (t.createdAt) {
      const d = new Date(t.createdAt);
      const dayNum = d.getDay() + 1;
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
 * Calculates sprint burndown series and committed/completed metrics from persisted data.
 * Pure, robust calculation function.
 */
export const calculateSprintBurndownMetrics = ({
  sprint,
  tasks = [],
  workflow = null,
  unit = "estimatedHours", // 'estimatedHours' | 'storyPoints'
  now = new Date(),
}) => {
  const effectiveWorkflow = workflow || { statuses: [] };
  const doneKeys = new Set(getCompletedStatusKeys(effectiveWorkflow));

  // Determine sprint date boundaries
  const nowTime = now.getTime();
  const sprintCreated = sprint?.createdAt ? new Date(sprint.createdAt) : new Date(nowTime - 7 * 86400000);
  const sprintStart = sprint?.startDate ? new Date(sprint.startDate) : sprintCreated;
  const sprintEnd = sprint?.endDate
    ? new Date(sprint.endDate)
    : sprint?.completedAt
    ? new Date(sprint.completedAt)
    : new Date(sprintStart.getTime() + 14 * 86400000);

  // Normalize dates to start of day UTC
  const startDay = new Date(Date.UTC(sprintStart.getUTCFullYear(), sprintStart.getUTCMonth(), sprintStart.getUTCDate()));
  const endDay = new Date(Date.UTC(sprintEnd.getUTCFullYear(), sprintEnd.getUTCMonth(), sprintEnd.getUTCDate(), 23, 59, 59, 999));

  // Task work evaluation helper
  const getTaskValue = (task) => {
    if (unit === "storyPoints") {
      return Number(task.storyPoints) > 0 ? Number(task.storyPoints) : 1;
    }
    // Default: estimatedHours (fallback to 1 if not estimated)
    return Number(task.estimatedHours) > 0 ? Number(task.estimatedHours) : 1;
  };

  // Scope & Task metrics
  let totalCommittedWork = 0;
  let totalCompletedWork = 0;
  let totalTasks = tasks.length;
  let completedTasks = 0;
  let carryoverTasks = 0;
  let carryoverWork = 0;
  let scopeAddedTasks = 0;
  let scopeAddedWork = 0;

  tasks.forEach((t) => {
    const val = getTaskValue(t);
    totalCommittedWork += val;

    const isDone = isStatusCompleted(t.status, effectiveWorkflow) || doneKeys.has(t.status);
    if (isDone) {
      completedTasks += 1;
      totalCompletedWork += val;
    } else {
      carryoverTasks += 1;
      carryoverWork += val;
    }

    // Check if task was added after sprint start (scope change)
    if (t.createdAt && new Date(t.createdAt).getTime() > sprintStart.getTime() + 86400000) {
      scopeAddedTasks += 1;
      scopeAddedWork += val;
    }
  });

  // Burndown timeline generation
  // Generate each day from sprint start to sprint end
  const burndownTimeline = [];
  const oneDayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / oneDayMs) + 1);

  let currentDayTime = startDay.getTime();
  const dayLabels = [];

  for (let d = 0; d < totalDays; d++) {
    const dayDate = new Date(currentDayTime);
    const dayIso = dayDate.toISOString().slice(0, 10);
    const dayLabel = dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    dayLabels.push({ dayDate, dayIso, dayLabel });
    currentDayTime += oneDayMs;
  }

  // Calculate remaining work day by day
  // Ideal line: linearly decreases from totalCommittedWork to 0
  const idealBurnRate = totalDays > 1 ? totalCommittedWork / (totalDays - 1) : totalCommittedWork;

  dayLabels.forEach((dl, index) => {
    const dayEndTimestamp = dl.dayDate.getTime() + oneDayMs - 1;

    // Ideal remaining
    const idealRemaining = Math.max(0, Math.round((totalCommittedWork - index * idealBurnRate) * 10) / 10);

    // Actual remaining up to this day:
    // A task was completed on or before dayEndTimestamp if it is done and updatedAt <= dayEndTimestamp
    if (dayEndTimestamp <= nowTime + oneDayMs) {
      let burnedSoFar = 0;
      tasks.forEach((t) => {
        const isDone = isStatusCompleted(t.status, effectiveWorkflow) || doneKeys.has(t.status);
        if (isDone) {
          const completedDate = t.updatedAt ? new Date(t.updatedAt).getTime() : sprintEnd.getTime();
          if (completedDate <= dayEndTimestamp) {
            burnedSoFar += getTaskValue(t);
          }
        }
      });

      const actualRemaining = Math.max(0, Math.round((totalCommittedWork - burnedSoFar) * 10) / 10);

      burndownTimeline.push({
        date: dl.dayIso,
        label: dl.dayLabel,
        ideal: idealRemaining,
        actual: actualRemaining,
        isFuture: false,
      });
    } else {
      // Future date relative to current time: actual is null so chart stops plotting
      burndownTimeline.push({
        date: dl.dayIso,
        label: dl.dayLabel,
        ideal: idealRemaining,
        actual: null,
        isFuture: true,
      });
    }
  });

  const completionRate = totalCommittedWork > 0 ? Math.round((totalCompletedWork / totalCommittedWork) * 100) : 0;

  return {
    sprintId: sprint?._id,
    sprintName: sprint?.name || "Sprint",
    sprintGoal: sprint?.goal || "",
    sprintStatus: sprint?.status || "planned",
    startDate: sprint?.startDate || null,
    endDate: sprint?.endDate || null,
    capacity: sprint?.capacity || null,
    measurementUnit: unit, // 'estimatedHours' or 'storyPoints'
    totalCommittedWork: Math.round(totalCommittedWork * 10) / 10,
    totalCompletedWork: Math.round(totalCompletedWork * 10) / 10,
    totalRemainingWork: Math.max(0, Math.round((totalCommittedWork - totalCompletedWork) * 10) / 10),
    completionRate,
    taskStats: {
      total: totalTasks,
      completed: completedTasks,
      carryover: carryoverTasks,
      scopeAdded: scopeAddedTasks,
    },
    scopeChanges: {
      addedTasks: scopeAddedTasks,
      addedWork: Math.round(scopeAddedWork * 10) / 10,
      carryoverWork: Math.round(carryoverWork * 10) / 10,
    },
    burndownTimeline,
    isOverloaded: Boolean(sprint?.capacity && totalCommittedWork > sprint.capacity),
  };
};

/**
 * Controller: GET /api/analytics/project/:projectId
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

    const dateRange = buildDateFilterRange({ range, startDate, endDate });
    const workflow = await Workflow.findOne({ projectId });

    const tasks = await Task.find({ projectId })
      .populate("assignedTo", "name email avatar")
      .select("title status priority dueDate assignedTo createdAt updatedAt estimatedHours storyPoints");

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

/**
 * Controller: GET /api/analytics/project/:projectId/velocity
 * Historical sprint velocity across project sprints with average velocity.
 */
export const getProjectSprintVelocity = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { unit = "estimatedHours" } = req.query; // 'estimatedHours' | 'storyPoints'

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view velocity for this project" });
    }

    const workflow = await Workflow.findOne({ projectId });
    const doneKeys = new Set(getCompletedStatusKeys(workflow));

    // Fetch all sprints for project sorted chronologically
    const sprints = await Sprint.find({ projectId })
      .sort({ startDate: 1, createdAt: 1 });

    const sprintIds = sprints.map((s) => s._id);
    const sprintTasks = await Task.find({ sprintId: { $in: sprintIds } })
      .select("sprintId status estimatedHours storyPoints createdAt updatedAt");

    const velocityData = sprints.map((s) => {
      const sTasks = sprintTasks.filter((t) => t.sprintId?.toString() === s._id.toString());

      let committed = 0;
      let completed = 0;

      sTasks.forEach((t) => {
        const val = unit === "storyPoints"
          ? (Number(t.storyPoints) > 0 ? Number(t.storyPoints) : 1)
          : (Number(t.estimatedHours) > 0 ? Number(t.estimatedHours) : 1);

        committed += val;
        const isDone = isStatusCompleted(t.status, workflow) || doneKeys.has(t.status);
        if (isDone) {
          completed += val;
        }
      });

      return {
        sprintId: s._id,
        sprintName: s.name,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        capacity: s.capacity,
        committed: Math.round(committed * 10) / 10,
        completed: Math.round(completed * 10) / 10,
        velocity: Math.round(completed * 10) / 10,
        taskCount: sTasks.length,
      };
    });

    // Calculate average velocity across completed and active sprints
    const completedOrActive = velocityData.filter((s) => s.status === "completed" || s.status === "active");
    const totalVelocity = completedOrActive.reduce((sum, s) => sum + s.velocity, 0);
    const averageVelocity = completedOrActive.length > 0
      ? Math.round((totalVelocity / completedOrActive.length) * 10) / 10
      : 0;

    res.json({
      projectId,
      measurementUnit: unit,
      averageVelocity,
      totalSprintsAnalyzed: sprints.length,
      sprints: velocityData,
    });
  } catch (err) {
    console.error("Sprint Velocity Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Controller: GET /api/analytics/sprint/:sprintId/burndown
 * Detailed sprint burndown metrics with ideal vs actual remaining work timeline.
 */
export const getSprintBurndown = async (req, res) => {
  try {
    const { sprintId } = req.params;
    const { unit = "estimatedHours" } = req.query; // 'estimatedHours' | 'storyPoints'

    const { hasAccess, sprint, project } = await checkSprintAccess(sprintId, req.user._id);
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view burndown for this sprint" });
    }

    const workflow = await Workflow.findOne({ projectId: sprint.projectId });
    const tasks = await Task.find({ sprintId: sprint._id })
      .select("title status estimatedHours storyPoints createdAt updatedAt");

    const burndown = calculateSprintBurndownMetrics({
      sprint,
      tasks,
      workflow,
      unit,
      now: new Date(),
    });

    res.json(burndown);
  } catch (err) {
    console.error("Sprint Burndown Error:", err);
    res.status(500).json({ message: err.message });
  }
};

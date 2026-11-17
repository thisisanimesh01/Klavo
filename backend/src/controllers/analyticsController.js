import mongoose from "mongoose";
import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";
import Activity from "../models/Activity.js";
import Workflow from "../models/Workflow.js";
import Sprint from "../models/Sprint.js";
import Milestone from "../models/Milestone.js";
import SavedReport from "../models/SavedReport.js";
import { checkProjectAccess, checkSprintAccess } from "../utils/authHelpers.js";
import { isStatusCompleted, getCompletedStatusKeys, getStatusCategory } from "../utils/workflowHelpers.js";

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
 * Computes comprehensive project analytics metrics (ANL-01).
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
 * Calculates sprint burndown series and committed/completed metrics (ANL-02).
 */
export const calculateSprintBurndownMetrics = ({
  sprint,
  tasks = [],
  workflow = null,
  unit = "estimatedHours",
  now = new Date(),
}) => {
  const effectiveWorkflow = workflow || { statuses: [] };
  const doneKeys = new Set(getCompletedStatusKeys(effectiveWorkflow));

  const nowTime = now.getTime();
  const sprintCreated = sprint?.createdAt ? new Date(sprint.createdAt) : new Date(nowTime - 7 * 86400000);
  const sprintStart = sprint?.startDate ? new Date(sprint.startDate) : sprintCreated;
  const sprintEnd = sprint?.endDate
    ? new Date(sprint.endDate)
    : sprint?.completedAt
    ? new Date(sprint.completedAt)
    : new Date(sprintStart.getTime() + 14 * 86400000);

  const startDay = new Date(Date.UTC(sprintStart.getUTCFullYear(), sprintStart.getUTCMonth(), sprintStart.getUTCDate()));
  const endDay = new Date(Date.UTC(sprintEnd.getUTCFullYear(), sprintEnd.getUTCMonth(), sprintEnd.getUTCDate(), 23, 59, 59, 999));

  const getTaskValue = (task) => {
    if (unit === "storyPoints") {
      return Number(task.storyPoints) > 0 ? Number(task.storyPoints) : 1;
    }
    return Number(task.estimatedHours) > 0 ? Number(task.estimatedHours) : 1;
  };

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

    if (t.createdAt && new Date(t.createdAt).getTime() > sprintStart.getTime() + 86400000) {
      scopeAddedTasks += 1;
      scopeAddedWork += val;
    }
  });

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

  const idealBurnRate = totalDays > 1 ? totalCommittedWork / (totalDays - 1) : totalCommittedWork;

  dayLabels.forEach((dl, index) => {
    const dayEndTimestamp = dl.dayDate.getTime() + oneDayMs - 1;
    const idealRemaining = Math.max(0, Math.round((totalCommittedWork - index * idealBurnRate) * 10) / 10);

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
    measurementUnit: unit,
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
 * Computes deep team workload and capacity analysis metrics (ANL-03).
 * Pure, robust calculation function.
 */
export const calculateTeamWorkloadCapacityMetrics = ({
  teamMembers = [],
  tasks = [],
  sprint = null,
  workflow = null,
  unit = "estimatedHours", // 'estimatedHours' | 'storyPoints'
  defaultCapacityPerMember = 40,
  now = new Date(),
}) => {
  const effectiveWorkflow = workflow || { statuses: [] };
  const doneKeys = new Set(getCompletedStatusKeys(effectiveWorkflow));
  const nowTime = now.getTime();

  // Helper to extract numeric task work estimation based on unit
  const getTaskValue = (task) => {
    if (unit === "storyPoints") {
      return Number(task.storyPoints) > 0 ? Number(task.storyPoints) : null;
    }
    return Number(task.estimatedHours) > 0 ? Number(task.estimatedHours) : null;
  };

  // Build member capacity lookup from sprint.memberCapacities if present
  const configuredCapacityMap = new Map();
  if (sprint && Array.isArray(sprint.memberCapacities)) {
    sprint.memberCapacities.forEach((mc) => {
      const uId = mc.userId?._id ? mc.userId._id.toString() : String(mc.userId);
      configuredCapacityMap.set(uId, Number(mc.capacity));
    });
  }

  // Pre-seed member records with ALL team members (including members with 0 tasks)
  const memberMap = new Map();
  teamMembers.forEach((m) => {
    const mId = m._id ? m._id.toString() : m.id ? m.id.toString() : String(m);
    const configuredCap = configuredCapacityMap.has(mId)
      ? configuredCapacityMap.get(mId)
      : sprint?.capacity && teamMembers.length > 0
      ? Math.round(sprint.capacity / teamMembers.length)
      : defaultCapacityPerMember;

    memberMap.set(mId, {
      userId: mId,
      name: m.name || "Member",
      email: m.email || "",
      avatar: m.avatar || null,
      assignedCount: 0,
      completedCount: 0,
      pendingCount: 0,
      overdueCount: 0,
      unestimatedCount: 0,
      committedWork: 0,
      completedWork: 0,
      pendingWork: 0,
      capacity: configuredCap,
      utilizationRate: 0,
      isOverAllocated: false,
    });
  });

  // Track unassigned tasks and overall team aggregates
  let unassignedCount = 0;
  let unassignedEstimatedWork = 0;
  let unassignedUnestimatedCount = 0;

  let totalTasks = tasks.length;
  let totalCommittedWork = 0;
  let totalCompletedWork = 0;
  let totalPendingWork = 0;

  tasks.forEach((t) => {
    const workVal = getTaskValue(t);
    const isEstimated = workVal !== null;
    const effectiveVal = isEstimated ? workVal : 0;

    const isDone = isStatusCompleted(t.status, effectiveWorkflow) || doneKeys.has(t.status);
    const isOverdue = Boolean(t.dueDate && new Date(t.dueDate).getTime() < nowTime && !isDone);

    totalCommittedWork += effectiveVal;
    if (isDone) {
      totalCompletedWork += effectiveVal;
    } else {
      totalPendingWork += effectiveVal;
    }

    const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : [];

    if (assignees.length === 0) {
      unassignedCount += 1;
      if (isEstimated) {
        unassignedEstimatedWork += effectiveVal;
      } else {
        unassignedUnestimatedCount += 1;
      }
    } else {
      // Split work evenly among multiple assignees to avoid double-counting
      const splitValue = effectiveVal / assignees.length;

      assignees.forEach((assignee) => {
        const uId = assignee?._id
          ? assignee._id.toString()
          : typeof assignee === "object"
          ? String(assignee.id || assignee)
          : String(assignee);

        let rec = memberMap.get(uId);
        if (!rec) {
          rec = {
            userId: uId,
            name: assignee?.name || "Member",
            email: assignee?.email || "",
            avatar: assignee?.avatar || null,
            assignedCount: 0,
            completedCount: 0,
            pendingCount: 0,
            overdueCount: 0,
            unestimatedCount: 0,
            committedWork: 0,
            completedWork: 0,
            pendingWork: 0,
            capacity: defaultCapacityPerMember,
            utilizationRate: 0,
            isOverAllocated: false,
          };
          memberMap.set(uId, rec);
        }

        rec.assignedCount += 1;
        if (isDone) {
          rec.completedCount += 1;
          rec.completedWork += splitValue;
        } else {
          rec.pendingCount += 1;
          rec.pendingWork += splitValue;
        }

        if (isOverdue) {
          rec.overdueCount += 1;
        }

        if (!isEstimated) {
          rec.unestimatedCount += 1;
        }

        rec.committedWork += splitValue;
      });
    }
  });

  // Calculate member utilization rates and overallocation
  const members = Array.from(memberMap.values()).map((m) => {
    const committedRounded = Math.round(m.committedWork * 10) / 10;
    const completedRounded = Math.round(m.completedWork * 10) / 10;
    const pendingRounded = Math.round(m.pendingWork * 10) / 10;
    const cap = m.capacity;

    const utilizationRate = cap > 0 ? Math.round((committedRounded / cap) * 100) : 0;
    const isOverAllocated = cap > 0 && committedRounded > cap;

    return {
      ...m,
      committedWork: committedRounded,
      completedWork: completedRounded,
      pendingWork: pendingRounded,
      utilizationRate,
      isOverAllocated,
    };
  });

  // Sort members: highest committed work first
  members.sort((a, b) => b.committedWork - a.committedWork);

  // Calculate team total capacity and utilization
  const totalCapacity = members.reduce((sum, m) => sum + m.capacity, 0);
  const teamUtilizationRate = totalCapacity > 0 ? Math.round((totalCommittedWork / totalCapacity) * 100) : 0;

  // Workload Imbalance Analysis: standard deviation of committed work across members
  let standardDeviation = 0;
  if (members.length > 1) {
    const mean = totalCommittedWork / members.length;
    const variance = members.reduce((sum, m) => sum + Math.pow(m.committedWork - mean, 2), 0) / members.length;
    standardDeviation = Math.round(Math.sqrt(variance) * 10) / 10;
  }

  // Workload balance classification
  const overAllocatedMembersCount = members.filter((m) => m.isOverAllocated).length;
  const zeroWorkMembersCount = members.filter((m) => m.assignedCount === 0).length;
  const isImbalanced = Boolean(overAllocatedMembersCount > 0 && zeroWorkMembersCount > 0);

  return {
    measurementUnit: unit, // 'estimatedHours' or 'storyPoints'
    sprintId: sprint?._id || null,
    sprintName: sprint?.name || null,
    totalTasks,
    totalCommittedWork: Math.round(totalCommittedWork * 10) / 10,
    totalCompletedWork: Math.round(totalCompletedWork * 10) / 10,
    totalPendingWork: Math.round(totalPendingWork * 10) / 10,
    totalCapacity,
    teamUtilizationRate,
    isTeamOverloaded: totalCapacity > 0 && totalCommittedWork > totalCapacity,
    unassignedWork: {
      taskCount: unassignedCount,
      estimatedWork: Math.round(unassignedEstimatedWork * 10) / 10,
      unestimatedTaskCount: unassignedUnestimatedCount,
    },
    workloadBalance: {
      isImbalanced,
      standardDeviation,
      overAllocatedCount: overAllocatedMembersCount,
      zeroWorkCount: zeroWorkMembersCount,
    },
    members,
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
 */
export const getProjectSprintVelocity = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { unit = "estimatedHours" } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view velocity for this project" });
    }

    const workflow = await Workflow.findOne({ projectId });
    const doneKeys = new Set(getCompletedStatusKeys(workflow));

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
 */
export const getSprintBurndown = async (req, res) => {
  try {
    const { sprintId } = req.params;
    const { unit = "estimatedHours" } = req.query;

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

/**
 * Controller: GET /api/analytics/project/:projectId/workload-capacity
 * Comprehensive Team Workload and Capacity Analysis (ANL-03).
 * Query parameters: sprintId (optional), memberId (optional), range, startDate, endDate, unit
 */
export const getTeamWorkloadCapacity = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      sprintId,
      memberId,
      range = "all",
      startDate,
      endDate,
      unit = "estimatedHours",
      defaultCapacity = 40,
    } = req.query;

    const { hasAccess, project, team } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view workload analytics for this project",
      });
    }

    // Resolve date filter range if provided
    const dateRange = buildDateFilterRange({ range, startDate, endDate });

    // Fetch team members
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

    // Filter members if memberId specified
    if (memberId && memberId !== "all") {
      teamMembers = teamMembers.filter((m) => m._id.toString() === memberId.toString());
    }

    // Fetch sprint if sprintId specified
    let sprint = null;
    if (sprintId && sprintId !== "all") {
      sprint = await Sprint.findById(sprintId).populate("memberCapacities.userId", "name email");
    }

    // Build task query
    const taskQuery = { projectId };
    if (sprintId && sprintId !== "all") {
      taskQuery.sprintId = sprintId;
    }
    if (memberId && memberId !== "all") {
      taskQuery.assignedTo = memberId;
    }
    if (dateRange && dateRange.start && dateRange.end) {
      taskQuery.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
    }

    const tasks = await Task.find(taskQuery)
      .populate("assignedTo", "name email avatar")
      .select("title status priority dueDate assignedTo estimatedHours storyPoints sprintId createdAt updatedAt");

    const workflow = await Workflow.findOne({ projectId });

    const workloadAnalysis = calculateTeamWorkloadCapacityMetrics({
      teamMembers,
      tasks,
      sprint,
      workflow,
      unit,
      defaultCapacityPerMember: Number(defaultCapacity) || 40,
      now: new Date(),
    });

    res.json({
      projectId,
      projectName: project.name,
      ...workloadAnalysis,
    });
  } catch (err) {
    console.error("Team Workload Capacity Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Calculates quantile value from an ascending sorted array of numbers using nearest-rank / linear interpolation.
 */
export const calculatePercentile = (sortedArr, percentile) => {
  if (!sortedArr || sortedArr.length === 0) return null;
  if (sortedArr.length === 1) return sortedArr[0];
  const p = Math.max(0, Math.min(100, percentile)) / 100;
  const index = (sortedArr.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Math.round((sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight) * 10) / 10;
};

/**
 * Computes descriptive summary statistics (count, avg, median, p85, p90, p95, min, max) for an array of duration numbers (hours).
 */
export const calculateDurationStats = (durationsInHours) => {
  if (!durationsInHours || durationsInHours.length === 0) {
    return {
      count: 0,
      average: null,
      median: null,
      p85: null,
      p90: null,
      p95: null,
      min: null,
      max: null,
    };
  }

  const sorted = [...durationsInHours].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const average = Math.round((sum / count) * 10) / 10;
  const median = calculatePercentile(sorted, 50);
  const p85 = calculatePercentile(sorted, 85);
  const p90 = calculatePercentile(sorted, 90);
  const p95 = calculatePercentile(sorted, 95);
  const min = Math.round(sorted[0] * 10) / 10;
  const max = Math.round(sorted[sorted.length - 1] * 10) / 10;

  return {
    count,
    average,
    median,
    p85,
    p90,
    p95,
    min,
    max,
  };
};

/**
 * Calculates Task Completion & Cycle-Time Metrics (ANL-04).
 * Pure calculation function for unit testability and controller execution.
 */
export const calculateTaskCompletionCycleTimeMetrics = ({
  tasks = [],
  workflow = null,
  now = new Date(),
  dateRange = null,
}) => {
  const completedKeys = new Set(getCompletedStatusKeys(workflow));
  const currentDate = new Date(now);

  const completedTasks = [];
  const activeTasks = [];
  let reopenedTaskCount = 0;
  let overdueCompletedCount = 0;
  let onTimeCompletedCount = 0;

  const cycleDurationsHours = [];
  const leadDurationsHours = [];

  // Stage bottleneck tracking map: statusKey -> { statusKey, statusName, category, color, order, totalTimeMs, taskCount, avgHours }
  const statusMap = new Map();
  if (workflow && Array.isArray(workflow.statuses)) {
    workflow.statuses.forEach((s) => {
      statusMap.set(s.key, {
        key: s.key,
        name: s.name,
        category: s.category,
        color: s.color || "#6366f1",
        order: s.order || 0,
        totalTimeMs: 0,
        taskCount: 0,
      });
    });
  } else {
    [
      { key: "todo", name: "Todo", category: "todo", color: "#94a3b8", order: 0 },
      { key: "in-progress", name: "In Progress", category: "in_progress", color: "#3b82f6", order: 1 },
      { key: "review", name: "In Review", category: "review", color: "#f59e0b", order: 2 },
      { key: "done", name: "Done", category: "done", color: "#10b981", order: 3 },
    ].forEach((s) => {
      statusMap.set(s.key, { ...s, totalTimeMs: 0, taskCount: 0 });
    });
  }

  // Inspect each task
  tasks.forEach((t) => {
    const isCompleted = completedKeys.has(t.status) || Boolean(t.completedAt);
    const completedTimestamp = t.completedAt ? new Date(t.completedAt) : null;
    const createdTimestamp = t.createdAt ? new Date(t.createdAt) : null;
    const startedTimestamp = t.startedAt ? new Date(t.startedAt) : null;

    // Check for reopened state in status history:
    // If a task exited a done status into a non-done status
    let wasReopened = false;
    if (Array.isArray(t.statusHistory) && t.statusHistory.length > 1) {
      let sawDone = false;
      for (const entry of t.statusHistory) {
        if (completedKeys.has(entry.status)) {
          sawDone = true;
        } else if (sawDone && !completedKeys.has(entry.status)) {
          wasReopened = true;
          break;
        }
      }
    }
    if (wasReopened) {
      reopenedTaskCount++;
    }

    // Accumulate stage times from actual status history
    if (Array.isArray(t.statusHistory) && t.statusHistory.length > 0) {
      t.statusHistory.forEach((entry) => {
        let entryDurationMs = entry.durationMs;
        if (entryDurationMs === null || entryDurationMs === undefined) {
          // If this is the current active entry
          if (entry.enteredAt && !entry.exitedAt) {
            entryDurationMs = Math.max(0, currentDate.getTime() - new Date(entry.enteredAt).getTime());
          }
        }
        if (typeof entryDurationMs === "number" && entryDurationMs >= 0) {
          let stageObj = statusMap.get(entry.status);
          if (!stageObj) {
            stageObj = {
              key: entry.status,
              name: entry.status,
              category: getStatusCategory(entry.status, workflow),
              color: "#64748b",
              order: 99,
              totalTimeMs: 0,
              taskCount: 0,
            };
            statusMap.set(entry.status, stageObj);
          }
          stageObj.totalTimeMs += entryDurationMs;
          stageObj.taskCount += 1;
        }
      });
    }

    if (isCompleted && completedTimestamp) {
      completedTasks.push(t);

      // Overdue vs on-time completion
      if (t.dueDate) {
        const due = new Date(t.dueDate);
        if (completedTimestamp.getTime() > due.getTime()) {
          overdueCompletedCount++;
        } else {
          onTimeCompletedCount++;
        }
      }

      // Lead Time: creation to completion (both timestamps must actually exist)
      if (createdTimestamp && !isNaN(createdTimestamp.getTime()) && completedTimestamp.getTime() >= createdTimestamp.getTime()) {
        const leadHours = (completedTimestamp.getTime() - createdTimestamp.getTime()) / (1000 * 60 * 60);
        leadDurationsHours.push(leadHours);
      }

      // Cycle Time: task start to completion (must have actual persisted startedAt)
      if (startedTimestamp && !isNaN(startedTimestamp.getTime()) && completedTimestamp.getTime() >= startedTimestamp.getTime()) {
        const cycleHours = (completedTimestamp.getTime() - startedTimestamp.getTime()) / (1000 * 60 * 60);
        cycleDurationsHours.push(cycleHours);
      }
    } else {
      activeTasks.push(t);
    }
  });

  // Calculate descriptive stats
  const cycleTimeStats = calculateDurationStats(cycleDurationsHours);
  const leadTimeStats = calculateDurationStats(leadDurationsHours);

  // Completion Trends by Day, Week, and Month (based on actual completedAt)
  // Day trend: group by YYYY-MM-DD
  const dayTrendMap = new Map();
  // Week trend: group by YYYY-Www (or week start date)
  const weekTrendMap = new Map();
  // Month trend: group by YYYY-MM
  const monthTrendMap = new Map();

  completedTasks.forEach((t) => {
    const cDate = new Date(t.completedAt);
    if (isNaN(cDate.getTime())) return;

    // Day key: YYYY-MM-DD
    const dayKey = cDate.toISOString().slice(0, 10);
    dayTrendMap.set(dayKey, (dayTrendMap.get(dayKey) || 0) + 1);

    // Month key: YYYY-MM
    const monthKey = cDate.toISOString().slice(0, 7);
    monthTrendMap.set(monthKey, (monthTrendMap.get(monthKey) || 0) + 1);

    // Week key: start of the week Sunday YYYY-MM-DD
    const d = new Date(cDate);
    const dayOfWeek = d.getDay();
    d.setDate(d.getDate() - dayOfWeek);
    const weekKey = d.toISOString().slice(0, 10);
    weekTrendMap.set(weekKey, (weekTrendMap.get(weekKey) || 0) + 1);
  });

  const dailyTrends = Array.from(dayTrendMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weeklyTrends = Array.from(weekTrendMap.entries())
    .map(([weekStart, count]) => ({ weekStart, label: `Week of ${weekStart}`, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  const monthlyTrends = Array.from(monthTrendMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Stage bottleneck analysis list
  const stageBottlenecks = Array.from(statusMap.values())
    .map((stage) => {
      const avgHours = stage.taskCount > 0 ? Math.round((stage.totalTimeMs / (stage.taskCount * 1000 * 60 * 60)) * 10) / 10 : 0;
      return {
        key: stage.key,
        name: stage.name,
        category: stage.category,
        color: stage.color,
        order: stage.order,
        taskCount: stage.taskCount,
        totalHours: Math.round((stage.totalTimeMs / (1000 * 60 * 60)) * 10) / 10,
        averageHours: avgHours,
      };
    })
    .sort((a, b) => a.order - b.order);

  // Overall rates and summaries
  const totalTasksCount = tasks.length;
  const completedCount = completedTasks.length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 1000) / 10 : 0;
  const reopenedRate = totalTasksCount > 0 ? Math.round((reopenedTaskCount / totalTasksCount) * 1000) / 10 : 0;
  const completedWithDueDateCount = overdueCompletedCount + onTimeCompletedCount;
  const onTimeCompletionRate = completedWithDueDateCount > 0 ? Math.round((onTimeCompletedCount / completedWithDueDateCount) * 1000) / 10 : null;

  return {
    summary: {
      totalTasks: totalTasksCount,
      completedTasks: completedCount,
      activeTasks: activeTasks.length,
      completionRate,
      reopenedCount: reopenedTaskCount,
      reopenedRate,
      overdueCompletedCount,
      onTimeCompletedCount,
      onTimeCompletionRate,
      tasksWithCycleTime: cycleDurationsHours.length,
      tasksWithLeadTime: leadDurationsHours.length,
      hasHistoricalCycleData: cycleDurationsHours.length > 0,
      hasHistoricalLeadData: leadDurationsHours.length > 0,
    },
    cycleTime: cycleTimeStats,
    leadTime: leadTimeStats,
    trends: {
      daily: dailyTrends,
      weekly: weeklyTrends,
      monthly: monthlyTrends,
    },
    stageBottlenecks,
  };
};

/**
 * Controller for GET /api/analytics/project/:projectId/completion-cycle-time
 */
export const getTaskCompletionCycleTime = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { sprintId, memberId, priority, range, startDate, endDate } = req.query;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not a member of this project's team" });
    }

    const dateRange = buildDateFilterRange({ range, startDate, endDate });

    // Build task query
    const taskQuery = { projectId };
    if (sprintId && sprintId !== "all") {
      taskQuery.sprintId = sprintId;
    }
    if (memberId && memberId !== "all") {
      taskQuery.assignedTo = memberId;
    }
    if (priority && priority !== "all") {
      taskQuery.priority = priority;
    }
    if (dateRange && dateRange.start && dateRange.end) {
      // Filter tasks whose creation or completion falls within the requested date bounds
      taskQuery.$or = [
        { completedAt: { $gte: dateRange.start, $lte: dateRange.end } },
        { createdAt: { $gte: dateRange.start, $lte: dateRange.end } },
      ];
    }

    const tasks = await Task.find(taskQuery)
      .populate("assignedTo", "name email avatar")
      .select("title status priority dueDate assignedTo sprintId createdAt updatedAt startedAt completedAt statusHistory");

    const workflow = await Workflow.findOne({ projectId });

    const metrics = calculateTaskCompletionCycleTimeMetrics({
      tasks,
      workflow,
      now: new Date(),
      dateRange,
    });

    res.json({
      projectId,
      projectName: project.name,
      ...metrics,
    });
  } catch (err) {
    console.error("Task Completion Cycle Time Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Calculates Project Health & Progress Indicators (ANL-05).
 * Transparent, deterministic score calculation (0–100) with detailed factor attribution.
 */
export const calculateProjectHealthMetrics = ({
  project = {},
  tasks = [],
  milestones = [],
  sprints = [],
  members = [],
  workflow = null,
  now = new Date(),
}) => {
  const currentDate = new Date(now);
  const totalTasks = tasks.length;
  const completedKeys = new Set(getCompletedStatusKeys(workflow));

  // State 1: Insufficient Data
  // Triggered when project has 0 tasks or insufficient telemetry to produce a meaningful score
  if (totalTasks === 0) {
    return {
      healthScore: null,
      healthState: "Insufficient Data",
      statusColor: "#94a3b8", // Slate
      summary: "Insufficient data to calculate health score. Add tasks to start tracking project telemetry.",
      factors: [],
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        completionRate: 0,
        overdueTasksCount: 0,
        overdueRate: 0,
        blockedTasksCount: 0,
        blockedRate: 0,
        overdueMilestonesCount: 0,
        milestonesCompletionRate: 0,
        overAllocatedMembersCount: 0,
        carryoverTasksCount: 0,
      },
      milestoneProgress: [],
      alerts: [
        {
          type: "info",
          title: "Insufficient Telemetry",
          message: "No tasks found in project. Add tasks and milestones to initialize health monitoring.",
        },
      ],
      healthHistory: [], // Only reliable snapshots; none fabricated
    };
  }

  // Identify task states
  let completedCount = 0;
  let overdueCount = 0;
  let blockedCount = 0;
  const incompleteTasks = [];

  // Build a lookup map of incomplete task IDs
  const incompleteTaskIdSet = new Set();
  tasks.forEach((t) => {
    const isDone = completedKeys.has(t.status) || Boolean(t.completedAt);
    if (isDone) {
      completedCount++;
    } else {
      incompleteTasks.push(t);
      if (t._id) incompleteTaskIdSet.add(t._id.toString());
    }
  });

  // Calculate overdue tasks among incomplete items
  incompleteTasks.forEach((t) => {
    if (t.dueDate) {
      const due = new Date(t.dueDate);
      if (due.getTime() < currentDate.getTime()) {
        overdueCount++;
      }
    }

    // Blocked check: has dependency of type 'blocked-by' where blocker is in incompleteTaskIdSet
    let isBlocked = false;
    if (Array.isArray(t.dependencies)) {
      for (const d of t.dependencies) {
        if (d.type === "blocked-by" && d.taskId) {
          const blockerIdStr = (d.taskId._id || d.taskId).toString();
          if (incompleteTaskIdSet.has(blockerIdStr)) {
            isBlocked = true;
            break;
          }
        }
      }
    }
    if (isBlocked) {
      blockedCount++;
    }
  });

  // Milestone Progress & Overdue Milestones
  let completedMilestonesCount = 0;
  let overdueMilestonesCount = 0;
  const milestoneProgress = milestones.map((m) => {
    const isCompleted = m.status === "completed" || Boolean(m.completedAt);
    if (isCompleted) {
      completedMilestonesCount++;
    } else if (m.dueDate && new Date(m.dueDate).getTime() < currentDate.getTime()) {
      overdueMilestonesCount++;
    }

    // Tasks associated with this milestone
    const mTasks = tasks.filter((t) => (t.milestoneId?._id || t.milestoneId)?.toString() === m._id?.toString());
    const mCompleted = mTasks.filter((t) => completedKeys.has(t.status) || Boolean(t.completedAt)).length;
    const mRate = mTasks.length > 0 ? Math.round((mCompleted / mTasks.length) * 100) : isCompleted ? 100 : 0;

    return {
      id: m._id,
      name: m.name,
      status: m.status,
      dueDate: m.dueDate,
      isOverdue: !isCompleted && Boolean(m.dueDate && new Date(m.dueDate).getTime() < currentDate.getTime()),
      totalTasks: mTasks.length,
      completedTasks: mCompleted,
      completionRate: mRate,
    };
  });

  const milestoneCompletionRate = milestones.length > 0 ? Math.round((completedMilestonesCount / milestones.length) * 100) : null;

  // Active Sprint & Carryover Detection
  const activeSprint = sprints.find((s) => s.status === "active");
  let carryoverCount = 0;
  let activeSprintOverdue = 0;
  if (activeSprint) {
    const sprintTasks = tasks.filter((t) => (t.sprintId?._id || t.sprintId)?.toString() === activeSprint._id?.toString());
    sprintTasks.forEach((t) => {
      const isDone = completedKeys.has(t.status) || Boolean(t.completedAt);
      if (!isDone) {
        // If sprint end date has passed, or task is overdue
        if (activeSprint.endDate && new Date(activeSprint.endDate).getTime() < currentDate.getTime()) {
          carryoverCount++;
        }
        if (t.dueDate && new Date(t.dueDate).getTime() < currentDate.getTime()) {
          activeSprintOverdue++;
        }
      }
    });
  }

  // Workload and Member Capacity Risks
  let overAllocatedMembersCount = 0;
  if (members && members.length > 0) {
    const memberWorkload = new Map();
    members.forEach((m) => {
      memberWorkload.set(m._id.toString(), {
        name: m.name,
        assignedWork: 0,
        capacity: 40, // default
      });
    });

    tasks.forEach((t) => {
      const isDone = completedKeys.has(t.status) || Boolean(t.completedAt);
      if (!isDone && Array.isArray(t.assignedTo) && t.assignedTo.length > 0) {
        const workPerAssignee = (Number(t.estimatedHours) || 8) / t.assignedTo.length;
        t.assignedTo.forEach((assignee) => {
          const aId = (assignee._id || assignee).toString();
          if (memberWorkload.has(aId)) {
            memberWorkload.get(aId).assignedWork += workPerAssignee;
          }
        });
      }
    });

    memberWorkload.forEach((val) => {
      if (val.assignedWork > val.capacity) {
        overAllocatedMembersCount++;
      }
    });
  }

  // =========================================================================
  // Health Score Calculation Formula (Base = 100 points)
  // Transparent penalty attribution:
  // 1. Overdue Tasks Penalty: up to 30 points (overdueRate * 60, capped at 30)
  // 2. Blocked Tasks Penalty: up to 25 points (blockedRate * 50, capped at 25)
  // 3. Milestone Slippage Penalty: up to 20 points (10 pts per overdue milestone, max 20)
  // 4. Team Workload Over-allocation Penalty: up to 15 points (5 pts per over-allocated member, max 15)
  // 5. Sprint Delivery / Carryover Penalty: up to 10 points (5 pts if active sprint has carryover/overdue)
  // =========================================================================

  const overdueRate = totalTasks > 0 ? overdueCount / totalTasks : 0;
  const blockedRate = totalTasks > 0 ? blockedCount / totalTasks : 0;

  const overduePenalty = Math.min(30, Math.round(overdueRate * 60));
  const blockedPenalty = Math.min(25, Math.round(blockedRate * 50));
  const milestonePenalty = Math.min(20, overdueMilestonesCount * 10);
  const capacityPenalty = Math.min(15, overAllocatedMembersCount * 5);
  const sprintPenalty = carryoverCount > 0 || activeSprintOverdue > 0 ? 10 : 0;

  const totalDeductions = overduePenalty + blockedPenalty + milestonePenalty + capacityPenalty + sprintPenalty;
  const rawScore = Math.max(0, 100 - totalDeductions);
  const healthScore = Math.round(rawScore);

  // Health State Categories
  let healthState = "Healthy";
  let statusColor = "#10B981"; // Emerald
  if (healthScore < 50) {
    healthState = "Critical";
    statusColor = "#EF4444"; // Red
  } else if (healthScore < 80) {
    healthState = "At Risk";
    statusColor = "#F59E0B"; // Amber
  }

  // Factors Attribution Breakdown
  const factors = [
    {
      name: "Task Schedule Compliance",
      category: "Schedule",
      impact: overduePenalty > 0 ? "negative" : "positive",
      deduction: overduePenalty,
      description:
        overdueCount > 0
          ? `${overdueCount} incomplete task(s) are past their due date (${Math.round(overdueRate * 100)}% of project tasks).`
          : "All active tasks are currently within their scheduled due dates.",
      metricValue: `${overdueCount} overdue`,
    },
    {
      name: "Dependency & Blocker Gates",
      category: "Dependencies",
      impact: blockedPenalty > 0 ? "negative" : "positive",
      deduction: blockedPenalty,
      description:
        blockedCount > 0
          ? `${blockedCount} task(s) are blocked by unresolved preceding dependencies.`
          : "Zero tasks are blocked by incomplete dependency gates.",
      metricValue: `${blockedCount} blocked`,
    },
    {
      name: "Milestone Target Tracking",
      category: "Milestones",
      impact: milestonePenalty > 0 ? "negative" : "positive",
      deduction: milestonePenalty,
      description:
        overdueMilestonesCount > 0
          ? `${overdueMilestonesCount} project milestone(s) have slipped past their target completion dates.`
          : milestones.length > 0
          ? "All active milestones are tracking to schedule."
          : "No milestones configured for this project.",
      metricValue: `${overdueMilestonesCount} overdue`,
    },
    {
      name: "Team Workload & Allocation",
      category: "Capacity",
      impact: capacityPenalty > 0 ? "negative" : "positive",
      deduction: capacityPenalty,
      description:
        overAllocatedMembersCount > 0
          ? `${overAllocatedMembersCount} team member(s) have committed workload exceeding their capacity.`
          : "Team workload is balanced with no members over-allocated.",
      metricValue: `${overAllocatedMembersCount} overloaded`,
    },
    {
      name: "Iteration & Sprint Delivery",
      category: "Velocity",
      impact: sprintPenalty > 0 ? "negative" : "positive",
      deduction: sprintPenalty,
      description:
        sprintPenalty > 0
          ? `Active sprint has ${activeSprintOverdue} overdue item(s) or pending carryover.`
          : "Active sprint execution is on track without carryover risk.",
      metricValue: sprintPenalty > 0 ? "Carryover risk" : "On track",
    },
  ];

  // Actionable Risk Alerts
  const alerts = [];
  if (overdueCount > 0) {
    alerts.push({
      type: "critical",
      title: "Overdue Workload Detected",
      message: `${overdueCount} active task(s) have exceeded target due dates. Re-prioritize or reassign them to prevent further schedule slippage.`,
    });
  }
  if (blockedCount > 0) {
    alerts.push({
      type: "warning",
      title: "Blocked Tasks Requiring Resolution",
      message: `${blockedCount} task(s) cannot proceed due to unresolved blocking dependencies. Resolve prerequisites to unblock execution.`,
    });
  }
  if (overdueMilestonesCount > 0) {
    alerts.push({
      type: "critical",
      title: "Milestone Target Date Slipped",
      message: `${overdueMilestonesCount} key milestone(s) are past due. Review scope commitments and target deliverables.`,
    });
  }
  if (overAllocatedMembersCount > 0) {
    alerts.push({
      type: "warning",
      title: "Team Capacity Imbalance",
      message: `${overAllocatedMembersCount} team member(s) exceed 100% capacity utilization. Rebalance task assignments to prevent burnout.`,
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      type: "success",
      title: "Project Operating Nominally",
      message: "No schedule, dependency, milestone, or capacity risks detected. The project is healthy.",
    });
  }

  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return {
    healthScore,
    healthState,
    statusColor,
    summary:
      healthState === "Healthy"
        ? "Project is performing well with low operational risk across schedule, dependencies, and capacity."
        : healthState === "At Risk"
        ? "Project has moderate risks impacting schedule compliance or workload capacity that require attention."
        : "Project is in critical condition with significant overdue deliverables, unresolved blockers, or milestone slippage.",
    factors,
    metrics: {
      totalTasks,
      completedTasks: completedCount,
      completionRate,
      overdueTasksCount: overdueCount,
      overdueRate: Math.round(overdueRate * 100),
      blockedTasksCount: blockedCount,
      blockedRate: Math.round(blockedRate * 100),
      overdueMilestonesCount,
      milestonesCompletionRate: milestoneCompletionRate,
      overAllocatedMembersCount,
      carryoverTasksCount: carryoverCount,
    },
    milestoneProgress,
    alerts,
    healthHistory: [], // Explicit invariant: only genuine snapshots; never fabricated past scores
  };
};

/**
 * Controller for GET /api/analytics/project/:projectId/health
 */
export const getProjectHealth = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not a member of this project's team" });
    }

    const tasks = await Task.find({ projectId })
      .populate("assignedTo", "name email")
      .populate("dependencies.taskId", "title status priority")
      .select("title status priority dueDate assignedTo dependencies sprintId milestoneId estimatedHours createdAt updatedAt completedAt");

    const milestones = await Milestone.find({ projectId }).select("name status startDate dueDate completedAt");
    const sprints = await Sprint.find({ projectId }).select("name status startDate endDate capacity");
    const workflow = await Workflow.findOne({ projectId });

    // Fetch team members
    let members = [];
    const team = await Team.findById(project.teamId).populate("members", "name email").populate("owner", "name email");
    if (team) {
      const memberMap = new Map();
      if (team.owner) memberMap.set(team.owner._id.toString(), team.owner);
      (team.members || []).forEach((m) => {
        if (m && m._id) memberMap.set(m._id.toString(), m);
      });
      members = Array.from(memberMap.values());
    }

    const healthData = calculateProjectHealthMetrics({
      project,
      tasks,
      milestones,
      sprints,
      members,
      workflow,
      now: new Date(),
    });

    res.json({
      projectId,
      projectName: project.name,
      ...healthData,
    });
  } catch (err) {
    console.error("Project Health Analytics Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Normalizes and validates ISO date range boundaries for custom reports.
 * Returns null if no dates specified, or throws error if startDate > endDate.
 */
export const validateAndNormalizeDateRange = ({ range, startDate, endDate, dateField = "createdAt" }, now = new Date()) => {
  if (range && range !== "custom" && range !== "all") {
    const preset = buildDateFilterRange({ range }, now);
    return preset ? { ...preset, dateField } : null;
  }

  if (range === "custom" || startDate || endDate) {
    if (!startDate && !endDate) return null;

    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date("2099-12-31T23:59:59.999Z");

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date format provided for date range filter.");
    }

    if (start.getTime() > end.getTime()) {
      throw new Error("Start date cannot be after end date.");
    }

    // Normalize start to beginning of day if bare date string
    if (typeof startDate === "string" && startDate.length === 10) {
      start.setUTCHours(0, 0, 0, 0);
    }
    // Normalize end to end of day if bare date string
    if (typeof endDate === "string" && endDate.length === 10) {
      end.setUTCHours(23, 59, 59, 999);
    }

    return { start, end, dateField };
  }

  return null;
};

/**
 * Pure calculation function for custom report generation (ANL-06).
 * Groups and aggregates filtered tasks by chosen dimension with metrics summary.
 */
export const aggregateCustomReportData = ({
  tasks = [],
  workflow = null,
  groupBy = "status",
  sortBy = "createdAt",
  sortOrder = "desc",
  page = 1,
  limit = 100,
}) => {
  const completedKeys = new Set(getCompletedStatusKeys(workflow));
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const safePage = Math.max(1, Number(page) || 1);

  let totalEstimatedHours = 0;
  let totalStoryPoints = 0;
  let completedCount = 0;
  let overdueCount = 0;
  const now = new Date();

  // Grouping accumulator: groupKey -> { key, label, count, estimatedHours, storyPoints, completedCount }
  const groupsMap = new Map();

  tasks.forEach((t) => {
    const isCompleted = completedKeys.has(t.status) || Boolean(t.completedAt);
    if (isCompleted) completedCount++;

    const isOverdue = !isCompleted && t.dueDate && new Date(t.dueDate).getTime() < now.getTime();
    if (isOverdue) overdueCount++;

    const estHours = Number(t.estimatedHours) || 0;
    const sp = Number(t.storyPoints) || 0;
    totalEstimatedHours += estHours;
    totalStoryPoints += sp;

    // Resolve group key and label
    let groupKey = "uncategorized";
    let groupLabel = "Uncategorized";

    if (groupBy === "status") {
      groupKey = t.status || "todo";
      const statusObj = workflow?.statuses?.find((s) => s.key === groupKey);
      groupLabel = statusObj ? statusObj.name : groupKey;
    } else if (groupBy === "priority") {
      groupKey = t.priority || "medium";
      groupLabel = groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
    } else if (groupBy === "assignee") {
      if (Array.isArray(t.assignedTo) && t.assignedTo.length > 0) {
        const firstAssignee = t.assignedTo[0];
        groupKey = (firstAssignee._id || firstAssignee).toString();
        groupLabel = firstAssignee.name || "Unknown Member";
      } else {
        groupKey = "unassigned";
        groupLabel = "Unassigned";
      }
    } else if (groupBy === "sprint") {
      if (t.sprintId) {
        groupKey = (t.sprintId._id || t.sprintId).toString();
        groupLabel = t.sprintId.name || "Sprint";
      } else {
        groupKey = "backlog";
        groupLabel = "Backlog";
      }
    } else if (groupBy === "milestone") {
      if (t.milestoneId) {
        groupKey = (t.milestoneId._id || t.milestoneId).toString();
        groupLabel = t.milestoneId.name || "Milestone";
      } else {
        groupKey = "none";
        groupLabel = "No Milestone";
      }
    } else {
      groupKey = "all";
      groupLabel = "All Tasks";
    }

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        key: groupKey,
        label: groupLabel,
        count: 0,
        completedCount: 0,
        overdueCount: 0,
        estimatedHours: 0,
        storyPoints: 0,
      });
    }

    const g = groupsMap.get(groupKey);
    g.count++;
    if (isCompleted) g.completedCount++;
    if (isOverdue) g.overdueCount++;
    g.estimatedHours += estHours;
    g.storyPoints += sp;
  });

  const groups = Array.from(groupsMap.values()).map((g) => ({
    ...g,
    estimatedHours: Math.round(g.estimatedHours * 10) / 10,
    storyPoints: Math.round(g.storyPoints * 10) / 10,
    completionRate: g.count > 0 ? Math.round((g.completedCount / g.count) * 100) : 0,
  }));

  // Sort tasks for tabular view
  const sortedTasks = [...tasks].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (sortBy === "createdAt" || sortBy === "dueDate" || sortBy === "completedAt" || sortBy === "updatedAt") {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else if (sortBy === "estimatedHours" || sortBy === "storyPoints") {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    } else if (typeof aVal === "string") {
      return sortOrder === "asc" ? aVal.localeCompare(bVal || "") : (bVal || "").localeCompare(aVal);
    }

    return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
  });

  // Paginate tasks
  const totalTasks = sortedTasks.length;
  const startIndex = (safePage - 1) * safeLimit;
  const paginatedTasks = sortedTasks.slice(startIndex, startIndex + safeLimit);

  return {
    summary: {
      totalTasks,
      completedTasks: completedCount,
      overdueTasks: overdueCount,
      completionRate: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
      totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
      totalStoryPoints: Math.round(totalStoryPoints * 10) / 10,
      groupCount: groups.length,
    },
    groups,
    tasks: paginatedTasks,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: totalTasks,
      pages: Math.ceil(totalTasks / safeLimit) || 1,
    },
  };
};

/**
 * Controller: Run or generate custom report (POST /api/analytics/project/:projectId/custom-report)
 */
export const generateCustomReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      range,
      startDate,
      endDate,
      dateField = "createdAt",
      statuses,
      priorities,
      assignees,
      sprintId,
      milestoneId,
      groupBy = "status",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 100,
    } = req.body;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not a member of this project's team" });
    }

    // Build task query with strict project scope
    const query = { projectId };

    // Validate and apply date range
    const normalizedRange = validateAndNormalizeDateRange({
      range,
      startDate,
      endDate,
      dateField,
    });
    if (normalizedRange) {
      query[normalizedRange.dateField] = {
        $gte: normalizedRange.start,
        $lte: normalizedRange.end,
      };
    }

    // Multi-attribute filtering
    if (Array.isArray(statuses) && statuses.length > 0) {
      query.status = { $in: statuses };
    }
    if (Array.isArray(priorities) && priorities.length > 0) {
      query.priority = { $in: priorities };
    }
    if (Array.isArray(assignees) && assignees.length > 0) {
      if (assignees.includes("unassigned")) {
        query.$or = [{ assignedTo: { $size: 0 } }, { assignedTo: { $exists: false } }];
      } else {
        query.assignedTo = { $in: assignees };
      }
    }
    if (sprintId && sprintId !== "all") {
      query.sprintId = sprintId === "backlog" ? null : sprintId;
    }
    if (milestoneId && milestoneId !== "all") {
      query.milestoneId = milestoneId === "none" ? null : milestoneId;
    }

    // Query tasks with a sensible safety limit to prevent unbounded memory usage (max 1000 tasks)
    const tasks = await Task.find(query)
      .populate("assignedTo", "name email avatar")
      .populate("sprintId", "name status")
      .populate("milestoneId", "name status dueDate")
      .limit(1000);

    const workflow = await Workflow.findOne({ projectId });

    const reportResult = aggregateCustomReportData({
      tasks,
      workflow,
      groupBy,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    res.json({
      projectId,
      projectName: project.name,
      ...reportResult,
      appliedFilters: {
        range: range || "all",
        startDate: startDate || null,
        endDate: endDate || null,
        dateField,
        statuses: statuses || [],
        priorities: priorities || [],
        assignees: assignees || [],
        sprintId: sprintId || "all",
        milestoneId: milestoneId || "all",
        groupBy,
        sortBy,
        sortOrder,
      },
    });
  } catch (err) {
    console.error("Custom Report Generation Error:", err);
    res.status(400).json({ message: err.message || "Failed to generate custom report." });
  }
};

/**
 * Controller: List saved report configurations (GET /api/analytics/project/:projectId/saved-reports)
 */
export const getSavedReports = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view reports for this project" });
    }

    // Return reports that are either shared with the project team or created by the requester
    const reports = await SavedReport.find({
      projectId,
      $or: [{ isShared: true }, { createdBy: req.user._id }],
    })
      .populate("createdBy", "name email avatar")
      .sort({ updatedAt: -1 });

    res.json(reports);
  } catch (err) {
    console.error("Get Saved Reports Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Controller: Create saved report configuration (POST /api/analytics/project/:projectId/saved-reports)
 */
export const createSavedReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, isShared, reportType, groupBy, sortBy, sortOrder, filters, chartType } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Report name is required." });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to create reports for this project" });
    }

    const report = await SavedReport.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      projectId,
      teamId: project.teamId,
      createdBy: req.user._id,
      isShared: Boolean(isShared),
      reportType: reportType || "task_summary",
      groupBy: groupBy || "status",
      sortBy: sortBy || "createdAt",
      sortOrder: sortOrder || "desc",
      filters: filters || {},
      chartType: chartType || "bar",
    });

    await report.populate("createdBy", "name email avatar");
    res.status(201).json(report);
  } catch (err) {
    console.error("Create Saved Report Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Controller: Delete saved report configuration (DELETE /api/analytics/saved-reports/:reportId)
 */
export const deleteSavedReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await SavedReport.findById(reportId);
    if (!report) return res.status(404).json({ message: "Saved report not found" });

    // IDOR protection: only creator or team owner can delete
    const { hasAccess, project } = await checkProjectAccess(report.projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this project" });
    }

    const isCreator = report.createdBy.toString() === req.user._id.toString();
    const team = await Team.findById(report.teamId);
    const isOwner = team && team.owner && team.owner.toString() === req.user._id.toString();

    if (!isCreator && !isOwner) {
      return res.status(403).json({ message: "Forbidden: Only the report creator or team owner can delete this report" });
    }

    await SavedReport.findByIdAndDelete(reportId);
    res.json({ message: "Saved report deleted successfully", reportId });
  } catch (err) {
    console.error("Delete Saved Report Error:", err);
    res.status(500).json({ message: err.message });
  }
};

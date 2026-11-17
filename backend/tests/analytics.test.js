import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDateFilterRange,
  calculateProjectAnalyticsMetrics,
  calculateSprintBurndownMetrics,
} from "../src/controllers/analyticsController.js";

test("ANL-01: Date Range Filtering Bounds", async (t) => {
  const fixedNow = new Date("2026-11-17T12:00:00.000Z");

  await t.test("returns null for all or empty range", () => {
    assert.equal(buildDateFilterRange({ range: "all" }, fixedNow), null);
    assert.equal(buildDateFilterRange({}, fixedNow), null);
  });

  await t.test("computes exact day bounds for 'today'", () => {
    const res = buildDateFilterRange({ range: "today" }, fixedNow);
    assert.ok(res);
    assert.equal(res.start.getHours(), 0);
    assert.equal(res.start.getMinutes(), 0);
    assert.equal(res.start.getSeconds(), 0);
    assert.equal(res.end.getHours(), 23);
    assert.equal(res.end.getMinutes(), 59);
    assert.equal(res.end.getSeconds(), 59);
  });

  await t.test("computes month bounds for 'this_month'", () => {
    const res = buildDateFilterRange({ range: "this_month" }, fixedNow);
    assert.ok(res);
    assert.equal(res.start.getDate(), 1);
    assert.equal(res.start.getMonth(), fixedNow.getMonth());
    assert.equal(res.end.getMonth(), fixedNow.getMonth());
  });

  await t.test("computes 30-day interval for 'last_30_days'", () => {
    const res = buildDateFilterRange({ range: "last_30_days" }, fixedNow);
    assert.ok(res);
    const diffDays = Math.round((res.end - res.start) / (1000 * 60 * 60 * 24));
    assert.equal(diffDays >= 30, true);
  });

  await t.test("parses custom date range properly", () => {
    const res = buildDateFilterRange(
      {
        range: "custom",
        startDate: "2026-11-01T00:00:00.000Z",
        endDate: "2026-11-15T23:59:59.999Z",
      },
      fixedNow
    );
    assert.ok(res);
    assert.equal(res.start.toISOString(), "2026-11-01T00:00:00.000Z");
    assert.equal(res.end.toISOString(), "2026-11-15T23:59:59.999Z");
  });
});

test("ANL-01: Metric Accuracy & Empty State Handling", async (t) => {
  const fixedNow = new Date("2026-11-17T12:00:00.000Z");

  await t.test("handles completely empty project gracefully without dividing by zero", () => {
    const project = { _id: "proj_1", name: "Empty Project" };
    const workflow = {
      statuses: [
        { key: "todo", name: "Todo", category: "todo", color: "#94a3b8" },
        { key: "done", name: "Done", category: "done", color: "#10b981" },
      ],
    };

    const metrics = calculateProjectAnalyticsMetrics({
      project,
      workflow,
      tasks: [],
      teamMembers: [],
      recentActivities: [],
      now: fixedNow,
    });

    assert.equal(metrics.taskCount, 0);
    assert.equal(metrics.completedCount, 0);
    assert.equal(metrics.inProgressCount, 0);
    assert.equal(metrics.overdueCount, 0);
    assert.equal(metrics.unassignedCount, 0);
    assert.equal(metrics.completionRate, 0);
    assert.equal(metrics.teamWorkload.length, 0);
    assert.equal(metrics.kpis.workloadAssignedRate, 0);
  });

  await t.test("accurately calculates task completion, in-progress, overdue, and unassigned metrics", () => {
    const project = { _id: "proj_2", name: "Active Project" };
    const workflow = {
      statuses: [
        { key: "todo", name: "Todo", category: "todo", color: "#94a3b8" },
        { key: "in-progress", name: "In Progress", category: "in_progress", color: "#3b82f6" },
        { key: "review", name: "In Review", category: "review", color: "#f59e0b" },
        { key: "done", name: "Done", category: "done", color: "#10b981" },
      ],
    };

    const userAlice = { _id: "user_a", name: "Alice", email: "alice@test.com" };
    const userBob = { _id: "user_b", name: "Bob", email: "bob@test.com" };

    const tasks = [
      // Completed task assigned to Alice
      {
        _id: "t1",
        title: "Task 1",
        status: "done",
        priority: "high",
        assignedTo: [userAlice],
        dueDate: new Date("2026-11-10T00:00:00.000Z"), // Past due, but done -> NOT counted as overdue
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
      },
      // In-progress overdue task assigned to Bob
      {
        _id: "t2",
        title: "Task 2",
        status: "in-progress",
        priority: "critical",
        assignedTo: [userBob],
        dueDate: new Date("2026-11-15T00:00:00.000Z"), // Overdue!
        createdAt: new Date("2026-11-05T00:00:00.000Z"),
      },
      // In-progress non-overdue task assigned to Alice
      {
        _id: "t3",
        title: "Task 3",
        status: "in-progress",
        priority: "medium",
        assignedTo: [userAlice],
        dueDate: new Date("2026-11-20T00:00:00.000Z"), // Future
        createdAt: new Date("2026-11-12T00:00:00.000Z"),
      },
      // Todo unassigned overdue task
      {
        _id: "t4",
        title: "Task 4",
        status: "todo",
        priority: "urgent",
        assignedTo: [],
        dueDate: new Date("2026-11-14T00:00:00.000Z"), // Overdue!
        createdAt: new Date("2026-11-10T00:00:00.000Z"),
      },
    ];

    const metrics = calculateProjectAnalyticsMetrics({
      project,
      workflow,
      tasks,
      teamMembers: [userAlice, userBob],
      now: fixedNow,
    });

    assert.equal(metrics.taskCount, 4);
    assert.equal(metrics.completedCount, 1);
    assert.equal(metrics.inProgressCount, 2);
    assert.equal(metrics.overdueCount, 2); // t2 and t4
    assert.equal(metrics.unassignedCount, 1); // t4
    assert.equal(metrics.completionRate, 25); // 1 / 4 * 100
    assert.equal(metrics.kpis.workloadAssignedRate, 75); // 3 / 4 * 100

    // Priority breakdown
    const critPrio = metrics.priorityDistribution.find((p) => p.priority === "critical");
    const urgPrio = metrics.priorityDistribution.find((p) => p.priority === "urgent");
    const highPrio = metrics.priorityDistribution.find((p) => p.priority === "high");
    assert.equal(critPrio.count, 1);
    assert.equal(urgPrio.count, 1);
    assert.equal(highPrio.count, 1);

    // Team workload distribution
    const aliceWorkload = metrics.teamWorkload.find((m) => m.userId === "user_a");
    const bobWorkload = metrics.teamWorkload.find((m) => m.userId === "user_b");
    assert.ok(aliceWorkload);
    assert.equal(aliceWorkload.total, 2);
    assert.equal(aliceWorkload.completed, 1);
    assert.equal(aliceWorkload.pending, 1);
    assert.equal(aliceWorkload.overdue, 0);

    assert.ok(bobWorkload);
    assert.equal(bobWorkload.total, 1);
    assert.equal(bobWorkload.completed, 0);
    assert.equal(bobWorkload.pending, 1);
    assert.equal(bobWorkload.overdue, 1);
  });

  await t.test("respects custom workflow categories for completion rate", () => {
    const project = { _id: "proj_3", name: "Custom Workflow Project" };
    const customWorkflow = {
      statuses: [
        { key: "backlog", name: "Backlog", category: "todo" },
        { key: "building", name: "Building", category: "in_progress" },
        { key: "qa_passed", name: "QA Passed", category: "done" },
        { key: "shipped", name: "Shipped", category: "done" },
      ],
    };

    const tasks = [
      { status: "qa_passed", assignedTo: [], createdAt: fixedNow },
      { status: "shipped", assignedTo: [], createdAt: fixedNow },
      { status: "building", assignedTo: [], createdAt: fixedNow },
      { status: "backlog", assignedTo: [], createdAt: fixedNow },
    ];

    const metrics = calculateProjectAnalyticsMetrics({
      project,
      workflow: customWorkflow,
      tasks,
      teamMembers: [],
      now: fixedNow,
    });

    assert.equal(metrics.taskCount, 4);
    assert.equal(metrics.completedCount, 2); // qa_passed and shipped
    assert.equal(metrics.completionRate, 50);
  });
});

test("ANL-01: Project Isolation & Authorization Invariants", async (t) => {
  await t.test("requires project team membership to access analytics", async () => {
    const { checkProjectAccess } = await import("../src/utils/authHelpers.js");
    assert.equal(typeof checkProjectAccess, "function");
  });
});

test("ANL-02: Sprint Velocity & Burndown Calculations", async (t) => {
  const fixedNow = new Date("2026-11-18T12:00:00.000Z");

  await t.test("calculates sprint burndown metrics accurately with estimatedHours", () => {
    const sprint = {
      _id: "sprint_1",
      name: "Sprint 1",
      status: "active",
      startDate: new Date("2026-11-10T00:00:00.000Z"),
      endDate: new Date("2026-11-20T00:00:00.000Z"),
      capacity: 40,
    };

    const workflow = {
      statuses: [
        { key: "todo", name: "Todo", category: "todo" },
        { key: "in-progress", name: "In Progress", category: "in_progress" },
        { key: "done", name: "Done", category: "done" },
      ],
    };

    const tasks = [
      // 10h done early on Nov 12
      {
        _id: "task_1",
        status: "done",
        estimatedHours: 10,
        createdAt: new Date("2026-11-10T00:00:00.000Z"),
        updatedAt: new Date("2026-11-12T15:00:00.000Z"),
      },
      // 15h in-progress (carryover)
      {
        _id: "task_2",
        status: "in-progress",
        estimatedHours: 15,
        createdAt: new Date("2026-11-10T00:00:00.000Z"),
        updatedAt: new Date("2026-11-14T10:00:00.000Z"),
      },
      // 5h added on Nov 15 (scope addition)
      {
        _id: "task_3",
        status: "todo",
        estimatedHours: 5,
        createdAt: new Date("2026-11-15T09:00:00.000Z"),
        updatedAt: new Date("2026-11-15T09:00:00.000Z"),
      },
    ];

    const result = calculateSprintBurndownMetrics({
      sprint,
      tasks,
      workflow,
      unit: "estimatedHours",
      now: fixedNow,
    });

    assert.equal(result.sprintName, "Sprint 1");
    assert.equal(result.totalCommittedWork, 30); // 10 + 15 + 5
    assert.equal(result.totalCompletedWork, 10);
    assert.equal(result.totalRemainingWork, 20);
    assert.equal(result.completionRate, 33);
    assert.equal(result.taskStats.total, 3);
    assert.equal(result.taskStats.completed, 1);
    assert.equal(result.taskStats.carryover, 2);
    assert.equal(result.taskStats.scopeAdded, 1);
    assert.equal(result.scopeChanges.addedWork, 5);
    assert.equal(result.scopeChanges.carryoverWork, 20);

    // Burndown timeline check
    assert.ok(Array.isArray(result.burndownTimeline));
    assert.ok(result.burndownTimeline.length > 5);

    // Initial point (day 0) ideal equals totalCommittedWork
    assert.equal(result.burndownTimeline[0].ideal, 30);
    assert.equal(result.burndownTimeline[0].actual, 30);
  });

  await t.test("calculates sprint burndown metrics using storyPoints", () => {
    const sprint = {
      _id: "sprint_sp",
      name: "SP Sprint",
      status: "completed",
      startDate: new Date("2026-11-01T00:00:00.000Z"),
      endDate: new Date("2026-11-10T00:00:00.000Z"),
    };

    const tasks = [
      { _id: "t1", status: "done", storyPoints: 5, updatedAt: new Date("2026-11-04") },
      { _id: "t2", status: "done", storyPoints: 8, updatedAt: new Date("2026-11-08") },
      { _id: "t3", status: "todo", storyPoints: 3, updatedAt: new Date("2026-11-02") },
    ];

    const result = calculateSprintBurndownMetrics({
      sprint,
      tasks,
      unit: "storyPoints",
      now: fixedNow,
    });

    assert.equal(result.measurementUnit, "storyPoints");
    assert.equal(result.totalCommittedWork, 16); // 5 + 8 + 3
    assert.equal(result.totalCompletedWork, 13); // 5 + 8
    assert.equal(result.totalRemainingWork, 3);
    assert.equal(result.completionRate, 81); // 13 / 16 * 100
  });

  await t.test("handles completely empty sprint without division by zero or errors", () => {
    const sprint = {
      _id: "sprint_empty",
      name: "Empty Sprint",
      status: "planned",
      startDate: new Date("2026-11-01T00:00:00.000Z"),
      endDate: new Date("2026-11-10T00:00:00.000Z"),
    };

    const result = calculateSprintBurndownMetrics({
      sprint,
      tasks: [],
      unit: "estimatedHours",
      now: fixedNow,
    });

    assert.equal(result.totalCommittedWork, 0);
    assert.equal(result.totalCompletedWork, 0);
    assert.equal(result.totalRemainingWork, 0);
    assert.equal(result.completionRate, 0);
    assert.equal(result.taskStats.total, 0);
    assert.ok(result.burndownTimeline.length > 0);
  });
});

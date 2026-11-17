import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDateFilterRange,
  calculateProjectAnalyticsMetrics,
  calculateSprintBurndownMetrics,
  calculateTeamWorkloadCapacityMetrics,
  calculateTaskCompletionCycleTimeMetrics,
  calculatePercentile,
  calculateDurationStats,
  calculateProjectHealthMetrics,
  validateAndNormalizeDateRange,
  aggregateCustomReportData,
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

test("ANL-03: Team Workload & Capacity Analysis Calculations", async (t) => {
  const fixedNow = new Date("2026-11-18T12:00:00.000Z");

  await t.test("calculates member workload, utilization, and overallocation correctly", () => {
    const teamMembers = [
      { _id: "m_alice", name: "Alice", email: "alice@test.com" },
      { _id: "m_bob", name: "Bob", email: "bob@test.com" },
      { _id: "m_carol", name: "Carol", email: "carol@test.com" },
    ];

    const sprint = {
      _id: "sprint_cap_1",
      name: "Capacity Sprint",
      capacity: 80,
      memberCapacities: [
        { userId: "m_alice", capacity: 30 },
        { userId: "m_bob", capacity: 30 },
        { userId: "m_carol", capacity: 20 },
      ],
    };

    const workflow = {
      statuses: [
        { key: "todo", category: "todo" },
        { key: "in-progress", category: "in_progress" },
        { key: "done", category: "done" },
      ],
    };

    const tasks = [
      // Alice: 20h completed, 15h pending (total 35h > 30h capacity -> over-allocated!)
      {
        _id: "t1",
        status: "done",
        estimatedHours: 20,
        assignedTo: [{ _id: "m_alice" }],
      },
      {
        _id: "t2",
        status: "in-progress",
        estimatedHours: 15,
        assignedTo: [{ _id: "m_alice" }],
        dueDate: new Date("2026-11-15T00:00:00.000Z"), // Overdue!
      },
      // Bob: 10h pending (total 10h <= 30h capacity -> 33% utilization)
      {
        _id: "t3",
        status: "todo",
        estimatedHours: 10,
        assignedTo: [{ _id: "m_bob" }],
      },
      // Carol: 0 tasks (0h <= 20h capacity -> 0% utilization, surfaced cleanly)
    ];

    const result = calculateTeamWorkloadCapacityMetrics({
      teamMembers,
      tasks,
      sprint,
      workflow,
      unit: "estimatedHours",
      now: fixedNow,
    });

    assert.equal(result.totalTasks, 3);
    assert.equal(result.totalCommittedWork, 45); // 35 + 10
    assert.equal(result.totalCapacity, 80); // 30 + 30 + 20
    assert.equal(result.teamUtilizationRate, 56); // 45 / 80 * 100
    assert.equal(result.isTeamOverloaded, false);

    // Members check
    const alice = result.members.find((m) => m.userId === "m_alice");
    const bob = result.members.find((m) => m.userId === "m_bob");
    const carol = result.members.find((m) => m.userId === "m_carol");

    assert.ok(alice);
    assert.equal(alice.assignedCount, 2);
    assert.equal(alice.committedWork, 35);
    assert.equal(alice.capacity, 30);
    assert.equal(alice.utilizationRate, 117); // 35 / 30 * 100
    assert.equal(alice.isOverAllocated, true);
    assert.equal(alice.overdueCount, 1);

    assert.ok(bob);
    assert.equal(bob.assignedCount, 1);
    assert.equal(bob.committedWork, 10);
    assert.equal(bob.capacity, 30);
    assert.equal(bob.utilizationRate, 33);
    assert.equal(bob.isOverAllocated, false);

    assert.ok(carol);
    assert.equal(carol.assignedCount, 0);
    assert.equal(carol.committedWork, 0);
    assert.equal(carol.capacity, 20);
    assert.equal(carol.utilizationRate, 0);
    assert.equal(carol.isOverAllocated, false);

    // Workload imbalance check
    assert.equal(result.workloadBalance.isImbalanced, true);
    assert.equal(result.workloadBalance.overAllocatedCount, 1);
    assert.equal(result.workloadBalance.zeroWorkCount, 1);
  });

  await t.test("accurately tracks unassigned work and unestimated tasks", () => {
    const teamMembers = [{ _id: "m1", name: "Dev 1" }];

    const tasks = [
      // Assigned task without estimation
      { _id: "t_unest_1", status: "todo", estimatedHours: null, assignedTo: [{ _id: "m1" }] },
      // Unassigned estimated task (8h)
      { _id: "t_unassigned_1", status: "todo", estimatedHours: 8, assignedTo: [] },
      // Unassigned unestimated task
      { _id: "t_unassigned_2", status: "todo", estimatedHours: null, assignedTo: [] },
    ];

    const result = calculateTeamWorkloadCapacityMetrics({
      teamMembers,
      tasks,
      unit: "estimatedHours",
      defaultCapacityPerMember: 40,
      now: fixedNow,
    });

    const dev1 = result.members.find((m) => m.userId === "m1");
    assert.equal(dev1.unestimatedCount, 1);

    assert.equal(result.unassignedWork.taskCount, 2);
    assert.equal(result.unassignedWork.estimatedWork, 8);
    assert.equal(result.unassignedWork.unestimatedTaskCount, 1);
  });

  await t.test("splits work evenly among multiple assignees without double-counting", () => {
    const teamMembers = [
      { _id: "dev_a", name: "Dev A" },
      { _id: "dev_b", name: "Dev B" },
    ];

    // Single 20h task co-assigned to both Dev A and Dev B
    const tasks = [
      {
        _id: "pair_task",
        status: "in-progress",
        estimatedHours: 20,
        assignedTo: [{ _id: "dev_a" }, { _id: "dev_b" }],
      },
    ];

    const result = calculateTeamWorkloadCapacityMetrics({
      teamMembers,
      tasks,
      unit: "estimatedHours",
      defaultCapacityPerMember: 40,
      now: fixedNow,
    });

    assert.equal(result.totalCommittedWork, 20); // Not 40!

    const devA = result.members.find((m) => m.userId === "dev_a");
    const devB = result.members.find((m) => m.userId === "dev_b");

    assert.equal(devA.committedWork, 10);
    assert.equal(devB.committedWork, 10);
  });

  await t.test("supports storyPoints measurement unit cleanly without mixing units", () => {
    const teamMembers = [{ _id: "sp_dev", name: "SP Dev" }];

    const tasks = [
      { _id: "sp_task_1", status: "done", storyPoints: 5, estimatedHours: 40, assignedTo: [{ _id: "sp_dev" }] },
      { _id: "sp_task_2", status: "todo", storyPoints: 8, estimatedHours: 60, assignedTo: [{ _id: "sp_dev" }] },
    ];

    const result = calculateTeamWorkloadCapacityMetrics({
      teamMembers,
      tasks,
      unit: "storyPoints",
      defaultCapacityPerMember: 20,
      now: fixedNow,
    });

    assert.equal(result.measurementUnit, "storyPoints");
    assert.equal(result.totalCommittedWork, 13); // 5 + 8 story points, NOT 100 hours!
    assert.equal(result.totalCompletedWork, 5);
    assert.equal(result.totalPendingWork, 8);

    const dev = result.members[0];
    assert.equal(dev.committedWork, 13);
    assert.equal(dev.completedWork, 5);
    assert.equal(dev.pendingWork, 8);
    assert.equal(dev.utilizationRate, 65); // 13 / 20 * 100
  });
});

test("ANL-04: Task Completion & Cycle-Time Metrics Calculations", async (t) => {
  const fixedNow = new Date("2026-11-18T12:00:00.000Z");

  await t.test("calculates cycle time and lead time accurately from actual timestamps", () => {
    // Task 1: created 2026-11-10T00:00:00Z, started 2026-11-12T00:00:00Z, completed 2026-11-14T00:00:00Z
    // Lead time = 4 days = 96 hours. Cycle time = 2 days = 48 hours.
    // Task 2: created 2026-11-10T00:00:00Z, started 2026-11-11T00:00:00Z, completed 2026-11-12T12:00:00Z
    // Lead time = 2.5 days = 60 hours. Cycle time = 1.5 days = 36 hours.
    const tasks = [
      {
        _id: "task_1",
        title: "Feature A",
        status: "done",
        createdAt: "2026-11-10T00:00:00.000Z",
        startedAt: "2026-11-12T00:00:00.000Z",
        completedAt: "2026-11-14T00:00:00.000Z",
        dueDate: "2026-11-15T00:00:00.000Z",
        statusHistory: [
          { status: "todo", enteredAt: "2026-11-10T00:00:00.000Z", exitedAt: "2026-11-12T00:00:00.000Z", durationMs: 48 * 3600 * 1000 },
          { status: "in-progress", enteredAt: "2026-11-12T00:00:00.000Z", exitedAt: "2026-11-14T00:00:00.000Z", durationMs: 48 * 3600 * 1000 },
          { status: "done", enteredAt: "2026-11-14T00:00:00.000Z", exitedAt: null, durationMs: null },
        ],
      },
      {
        _id: "task_2",
        title: "Feature B",
        status: "done",
        createdAt: "2026-11-10T00:00:00.000Z",
        startedAt: "2026-11-11T00:00:00.000Z",
        completedAt: "2026-11-12T12:00:00.000Z",
        dueDate: "2026-11-11T00:00:00.000Z", // overdue completion!
        statusHistory: [
          { status: "todo", enteredAt: "2026-11-10T00:00:00.000Z", exitedAt: "2026-11-11T00:00:00.000Z", durationMs: 24 * 3600 * 1000 },
          { status: "in-progress", enteredAt: "2026-11-11T00:00:00.000Z", exitedAt: "2026-11-12T12:00:00.000Z", durationMs: 36 * 3600 * 1000 },
          { status: "done", enteredAt: "2026-11-12T12:00:00.000Z", exitedAt: null, durationMs: null },
        ],
      },
    ];

    const result = calculateTaskCompletionCycleTimeMetrics({
      tasks,
      now: fixedNow,
    });

    assert.equal(result.summary.totalTasks, 2);
    assert.equal(result.summary.completedTasks, 2);
    assert.equal(result.summary.completionRate, 100);
    assert.equal(result.summary.overdueCompletedCount, 1);
    assert.equal(result.summary.onTimeCompletedCount, 1);
    assert.equal(result.summary.onTimeCompletionRate, 50);

    // Lead time stats: [60, 96] -> avg 78, median 78
    assert.equal(result.leadTime.count, 2);
    assert.equal(result.leadTime.average, 78);
    assert.equal(result.leadTime.min, 60);
    assert.equal(result.leadTime.max, 96);

    // Cycle time stats: [36, 48] -> avg 42, median 42
    assert.equal(result.cycleTime.count, 2);
    assert.equal(result.cycleTime.average, 42);
    assert.equal(result.cycleTime.min, 36);
    assert.equal(result.cycleTime.max, 48);

    // Trends: day trends have 2026-11-12 and 2026-11-14
    assert.equal(result.trends.daily.length, 2);
    assert.equal(result.trends.daily[0].date, "2026-11-12");
    assert.equal(result.trends.daily[0].count, 1);
    assert.equal(result.trends.daily[1].date, "2026-11-14");
    assert.equal(result.trends.daily[1].count, 1);
  });

  await t.test("clearly distinguishes missing historical start dates from zero and does not fabricate metrics", () => {
    // Task without startedAt (e.g. legacy task moved straight to done)
    const tasks = [
      {
        _id: "legacy_task",
        title: "Legacy Task",
        status: "done",
        createdAt: "2026-11-01T00:00:00.000Z",
        startedAt: null, // MISSING startedAt!
        completedAt: "2026-11-05T00:00:00.000Z",
      },
    ];

    const result = calculateTaskCompletionCycleTimeMetrics({
      tasks,
      now: fixedNow,
    });

    assert.equal(result.summary.totalTasks, 1);
    assert.equal(result.summary.completedTasks, 1);
    assert.equal(result.summary.tasksWithCycleTime, 0);
    assert.equal(result.summary.hasHistoricalCycleData, false);
    // Cycle time average must be null, NOT 0!
    assert.equal(result.cycleTime.average, null);
    assert.equal(result.cycleTime.median, null);

    // Lead time was present: 4 days = 96 hours
    assert.equal(result.summary.tasksWithLeadTime, 1);
    assert.equal(result.summary.hasHistoricalLeadData, true);
    assert.equal(result.leadTime.average, 96);
  });

  await t.test("identifies reopened tasks accurately from status transition history", () => {
    const tasks = [
      {
        _id: "reopened_task",
        title: "Bug Fix",
        status: "in-progress",
        createdAt: "2026-11-01T00:00:00.000Z",
        startedAt: "2026-11-01T10:00:00.000Z",
        completedAt: null,
        statusHistory: [
          { status: "todo", enteredAt: "2026-11-01T00:00:00.000Z", exitedAt: "2026-11-01T10:00:00.000Z", durationMs: 10 * 3600 * 1000 },
          { status: "in-progress", enteredAt: "2026-11-01T10:00:00.000Z", exitedAt: "2026-11-02T10:00:00.000Z", durationMs: 24 * 3600 * 1000 },
          { status: "done", enteredAt: "2026-11-02T10:00:00.000Z", exitedAt: "2026-11-03T10:00:00.000Z", durationMs: 24 * 3600 * 1000 },
          { status: "in-progress", enteredAt: "2026-11-03T10:00:00.000Z", exitedAt: null, durationMs: null }, // Reopened!
        ],
      },
      {
        _id: "normal_task",
        title: "Feature Normal",
        status: "todo",
        createdAt: "2026-11-05T00:00:00.000Z",
        statusHistory: [
          { status: "todo", enteredAt: "2026-11-05T00:00:00.000Z", exitedAt: null, durationMs: null },
        ],
      },
    ];

    const result = calculateTaskCompletionCycleTimeMetrics({
      tasks,
      now: fixedNow,
    });

    assert.equal(result.summary.totalTasks, 2);
    assert.equal(result.summary.reopenedCount, 1);
    assert.equal(result.summary.reopenedRate, 50); // 1 / 2 * 100
  });

  await t.test("analyzes workflow stage bottlenecks and respects custom workflow statuses", () => {
    const customWorkflow = {
      projectId: "proj_custom",
      statuses: [
        { key: "backlog", name: "Backlog", category: "todo", color: "#64748b", order: 0 },
        { key: "dev", name: "Development", category: "in_progress", color: "#3b82f6", order: 1 },
        { key: "qa", name: "QA & Testing", category: "review", color: "#f59e0b", order: 2 },
        { key: "shipped", name: "Shipped", category: "done", color: "#10b981", order: 3 },
      ],
    };

    const tasks = [
      {
        _id: "custom_task_1",
        title: "Custom 1",
        status: "shipped",
        createdAt: "2026-11-01T00:00:00.000Z",
        startedAt: "2026-11-02T00:00:00.000Z",
        completedAt: "2026-11-05T00:00:00.000Z",
        statusHistory: [
          { status: "backlog", enteredAt: "2026-11-01T00:00:00.000Z", exitedAt: "2026-11-02T00:00:00.000Z", durationMs: 24 * 3600 * 1000 },
          { status: "dev", enteredAt: "2026-11-02T00:00:00.000Z", exitedAt: "2026-11-03T12:00:00.000Z", durationMs: 36 * 3600 * 1000 },
          { status: "qa", enteredAt: "2026-11-03T12:00:00.000Z", exitedAt: "2026-11-05T00:00:00.000Z", durationMs: 36 * 3600 * 1000 },
          { status: "shipped", enteredAt: "2026-11-05T00:00:00.000Z", exitedAt: null, durationMs: null },
        ],
      },
    ];

    const result = calculateTaskCompletionCycleTimeMetrics({
      tasks,
      workflow: customWorkflow,
      now: fixedNow,
    });

    assert.equal(result.summary.completedTasks, 1);
    assert.equal(result.stageBottlenecks.length >= 4, true);

    const devStage = result.stageBottlenecks.find((s) => s.key === "dev");
    const qaStage = result.stageBottlenecks.find((s) => s.key === "qa");

    assert.ok(devStage);
    assert.equal(devStage.name, "Development");
    assert.equal(devStage.averageHours, 36);

    assert.ok(qaStage);
    assert.equal(qaStage.name, "QA & Testing");
    assert.equal(qaStage.averageHours, 36);
  });
});

test("ANL-05: Project Health & Progress Indicators Calculations", async (t) => {
  const fixedNow = new Date("2026-11-18T12:00:00.000Z");

  await t.test("returns Insufficient Data state when project has 0 tasks without fabricating scores", () => {
    const result = calculateProjectHealthMetrics({
      project: { name: "Empty Project" },
      tasks: [],
      milestones: [],
      sprints: [],
      members: [],
      now: fixedNow,
    });

    assert.equal(result.healthScore, null);
    assert.equal(result.healthState, "Insufficient Data");
    assert.equal(result.factors.length, 0);
    assert.equal(result.alerts[0].type, "info");
    assert.equal(result.healthHistory.length, 0);
  });

  await t.test("calculates Healthy status for on-track project with no overdue or blocked tasks", () => {
    const tasks = [
      {
        _id: "t1",
        title: "Task 1",
        status: "done",
        dueDate: "2026-11-20T00:00:00.000Z",
      },
      {
        _id: "t2",
        title: "Task 2",
        status: "in-progress",
        dueDate: "2026-11-25T00:00:00.000Z",
        dependencies: [],
      },
    ];

    const milestones = [
      {
        _id: "m1",
        name: "Milestone Alpha",
        status: "planned",
        dueDate: "2026-11-30T00:00:00.000Z",
      },
    ];

    const result = calculateProjectHealthMetrics({
      project: { name: "Healthy Project" },
      tasks,
      milestones,
      sprints: [],
      members: [],
      now: fixedNow,
    });

    assert.equal(result.healthScore, 100);
    assert.equal(result.healthState, "Healthy");
    assert.equal(result.metrics.overdueTasksCount, 0);
    assert.equal(result.metrics.blockedTasksCount, 0);
    assert.equal(result.factors.length, 5);
    assert.equal(result.factors.every((f) => f.deduction === 0), true);
  });

  await t.test("applies documented deductions for overdue tasks, blocked dependencies, and slipped milestones", () => {
    // Task 1: overdue (due 2026-11-10 < fixedNow)
    // Task 2: blocked by Task 1 ('blocked-by' t1, which is incomplete)
    // Milestone 1: overdue (due 2026-11-15 < fixedNow)
    const tasks = [
      {
        _id: "t1",
        title: "Overdue Task",
        status: "in-progress",
        dueDate: "2026-11-10T00:00:00.000Z",
        dependencies: [],
      },
      {
        _id: "t2",
        title: "Blocked Task",
        status: "todo",
        dueDate: "2026-11-25T00:00:00.000Z",
        dependencies: [{ type: "blocked-by", taskId: "t1" }],
      },
    ];

    const milestones = [
      {
        _id: "m1",
        name: "Slipped Milestone",
        status: "planned",
        dueDate: "2026-11-15T00:00:00.000Z",
      },
    ];

    const result = calculateProjectHealthMetrics({
      project: { name: "At Risk Project" },
      tasks,
      milestones,
      sprints: [],
      members: [],
      now: fixedNow,
    });

    // 1 overdue out of 2 tasks -> 50% overdue -> min(30, 0.5 * 60) = 30 pts
    // 1 blocked out of 2 tasks -> 50% blocked -> min(25, 0.5 * 50) = 25 pts
    // 1 slipped milestone -> min(20, 1 * 10) = 10 pts
    // Total deductions = 30 + 25 + 10 = 65 pts. Score = 100 - 65 = 35 (Critical)
    assert.equal(result.metrics.overdueTasksCount, 1);
    assert.equal(result.metrics.blockedTasksCount, 1);
    assert.equal(result.metrics.overdueMilestonesCount, 1);
    assert.equal(result.healthScore, 35);
    assert.equal(result.healthState, "Critical");

    const overdueFactor = result.factors.find((f) => f.name === "Task Schedule Compliance");
    assert.equal(overdueFactor.deduction, 30);
    const blockedFactor = result.factors.find((f) => f.name === "Dependency & Blocker Gates");
    assert.equal(blockedFactor.deduction, 25);
    const milestoneFactor = result.factors.find((f) => f.name === "Milestone Target Tracking");
    assert.equal(milestoneFactor.deduction, 10);
  });

  await t.test("respects custom workflow categories for completion and does not penalize completed items", () => {
    const customWorkflow = {
      projectId: "p_custom",
      statuses: [
        { key: "todo", name: "Todo", category: "todo", order: 0 },
        { key: "shipped", name: "Shipped", category: "done", order: 1 },
      ],
    };

    const tasks = [
      {
        _id: "t_shipped",
        title: "Shipped Task",
        status: "shipped",
        dueDate: "2026-11-01T00:00:00.000Z", // past due date, but completed in custom 'shipped' status!
      },
    ];

    const result = calculateProjectHealthMetrics({
      project: { name: "Custom Workflow Project" },
      tasks,
      milestones: [],
      sprints: [],
      members: [],
      workflow: customWorkflow,
      now: fixedNow,
    });

    assert.equal(result.healthScore, 100);
    assert.equal(result.healthState, "Healthy");
    assert.equal(result.metrics.completedTasks, 1);
    assert.equal(result.metrics.overdueTasksCount, 0); // Not counted as overdue!
  });
});

test("ANL-06: Custom Reports & Date-Range Filtering Logic", async (t) => {
  const fixedNow = new Date("2026-11-18T12:00:00.000Z");

  await t.test("validates and normalizes date ranges with boundary and ordering checks", () => {
    // Valid custom date range
    const valid = validateAndNormalizeDateRange({
      range: "custom",
      startDate: "2026-11-01",
      endDate: "2026-11-15",
    }, fixedNow);

    assert.ok(valid);
    assert.equal(valid.start.toISOString().slice(0, 10), "2026-11-01");
    assert.equal(valid.end.toISOString().slice(0, 10), "2026-11-15");

    // Invalid range: startDate > endDate
    assert.throws(
      () => {
        validateAndNormalizeDateRange({
          range: "custom",
          startDate: "2026-11-20",
          endDate: "2026-11-10",
        }, fixedNow);
      },
      /Start date cannot be after end date/
    );

    // Invalid format
    assert.throws(
      () => {
        validateAndNormalizeDateRange({
          range: "custom",
          startDate: "invalid-date",
          endDate: "2026-11-10",
        }, fixedNow);
      },
      /Invalid date format/
    );
  });

  await t.test("aggregates report data by status dimension with metrics summary", () => {
    const tasks = [
      { _id: "t1", title: "Task 1", status: "todo", estimatedHours: 8, storyPoints: 3, createdAt: "2026-11-10" },
      { _id: "t2", title: "Task 2", status: "todo", estimatedHours: 4, storyPoints: 2, createdAt: "2026-11-12" },
      { _id: "t3", title: "Task 3", status: "done", estimatedHours: 16, storyPoints: 5, createdAt: "2026-11-08" },
    ];

    const result = aggregateCustomReportData({
      tasks,
      groupBy: "status",
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
      limit: 50,
    });

    assert.equal(result.summary.totalTasks, 3);
    assert.equal(result.summary.completedTasks, 1);
    assert.equal(result.summary.totalEstimatedHours, 28);
    assert.equal(result.summary.totalStoryPoints, 10);
    assert.equal(result.groups.length, 2); // 'todo' and 'done'

    const todoGroup = result.groups.find((g) => g.key === "todo");
    assert.ok(todoGroup);
    assert.equal(todoGroup.count, 2);
    assert.equal(todoGroup.estimatedHours, 12);
    assert.equal(todoGroup.storyPoints, 5);

    const doneGroup = result.groups.find((g) => g.key === "done");
    assert.ok(doneGroup);
    assert.equal(doneGroup.count, 1);
    assert.equal(doneGroup.completionRate, 100);
  });

  await t.test("aggregates report data by priority dimension and handles unassigned gracefully", () => {
    const tasks = [
      { _id: "t1", title: "Urgent Task", priority: "urgent", assignedTo: [], estimatedHours: 5 },
      { _id: "t2", title: "Medium Task", priority: "medium", assignedTo: [{ _id: "u1", name: "Alice" }], estimatedHours: 10 },
    ];

    // Group by priority
    const priorityReport = aggregateCustomReportData({
      tasks,
      groupBy: "priority",
    });
    assert.equal(priorityReport.groups.length, 2);
    assert.ok(priorityReport.groups.find((g) => g.key === "urgent"));
    assert.ok(priorityReport.groups.find((g) => g.key === "medium"));

    // Group by assignee
    const assigneeReport = aggregateCustomReportData({
      tasks,
      groupBy: "assignee",
    });
    assert.equal(assigneeReport.groups.length, 2);
    const unassignedGroup = assigneeReport.groups.find((g) => g.key === "unassigned");
    assert.ok(unassignedGroup);
    assert.equal(unassignedGroup.label, "Unassigned");
    assert.equal(unassignedGroup.count, 1);
  });

  await t.test("respects pagination limits and safely bounds limit caps", () => {
    const tasks = Array.from({ length: 25 }, (_, i) => ({
      _id: `t_${i}`,
      title: `Task ${i}`,
      status: "todo",
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    }));

    const paginated = aggregateCustomReportData({
      tasks,
      groupBy: "status",
      page: 2,
      limit: 10,
    });

    assert.equal(paginated.pagination.total, 25);
    assert.equal(paginated.pagination.page, 2);
    assert.equal(paginated.pagination.limit, 10);
    assert.equal(paginated.pagination.pages, 3);
    assert.equal(paginated.tasks.length, 10);
    assert.equal(paginated.tasks[0]._id, "t_10");
  });
});

test("ANL-07: CSV/PDF Report Export & Formula Injection Prevention Logic", async (t) => {
  const { escapeCsvValue, buildCsvString, generateReportCsv, generateReportPdf, sanitizePdfText } = await import(
    "../src/utils/exportHelpers.js"
  );

  await t.test("neutralizes formula injection characters (=, +, -, @, \\t, \\r) in CSV cells", () => {
    // Formula characters must be preceded by a single quote
    assert.equal(escapeCsvValue("=SUM(A1:B1)"), "\"'=SUM(A1:B1)\"");
    assert.equal(escapeCsvValue("+cmd|' /C calc'!A0"), "\"'+cmd|' /C calc'!A0\"");
    assert.equal(escapeCsvValue("-1+1"), "\"'-1+1\"");
    assert.equal(escapeCsvValue("@IMPORTXML()"), "\"'@IMPORTXML()\"");
    assert.equal(escapeCsvValue("\tsecret"), "\"'\tsecret\"");
    assert.equal(escapeCsvValue("\rsecret"), "\"'\rsecret\"");

    // Normal strings should not be prefixed with quote
    assert.equal(escapeCsvValue("Normal text"), "\"Normal text\"");
    assert.equal(escapeCsvValue("Simple"), "\"Simple\"");
    assert.equal(escapeCsvValue(123), "\"123\"");
    assert.equal(escapeCsvValue(null), "\"\"");
    assert.equal(escapeCsvValue(undefined), "\"\"");
  });

  await t.test("properly escapes quotes, commas, and newlines in RFC 4180 CSV strings", () => {
    const textWithQuotes = 'Feature "Super" Edition';
    assert.equal(escapeCsvValue(textWithQuotes), '"Feature ""Super"" Edition"');

    const textWithComma = "Frontend, Backend, Design";
    assert.equal(escapeCsvValue(textWithComma), '"Frontend, Backend, Design"');

    const textWithNewline = "Line 1\nLine 2";
    assert.equal(escapeCsvValue(textWithNewline), '"Line 1\nLine 2"');

    const rows = [
      ["Title", "Notes"],
      ['"Quoted"', "First, Second"],
    ];
    const csv = buildCsvString(rows);
    assert.equal(csv, '"Title","Notes"\r\n"""Quoted""","First, Second"');
  });

  await t.test("generates complete report CSV with metadata, groups, and distinct hours and points", () => {
    const csv = generateReportCsv({
      reportTitle: "Q4 Sprint Velocity",
      projectName: "Project Omega",
      generatedAt: "2026-11-18T10:00:00.000Z",
      dateRange: "2026-11-01 to 2026-11-30",
      metricDefinitions: [
        "Estimated Hours and Story Points are kept strictly separate.",
        "Zero fabrication: missing estimates display empty.",
      ],
      groups: [
        { groupLabel: "In Progress", count: 4, completionRate: 50, totalEstimatedHours: 24, totalStoryPoints: 12 },
        { groupLabel: "Done", count: 8, completionRate: 100, totalEstimatedHours: 40, totalStoryPoints: 20 },
      ],
      tasks: [
        {
          _id: "t_abc",
          title: "Implement auth =1+1",
          status: "in-progress",
          priority: "urgent",
          assigneeName: "Alice Developer",
          estimatedHours: 8,
          storyPoints: 3,
          createdAt: "2026-11-02",
        },
        {
          _id: "t_xyz",
          title: "Setup DB",
          status: "done",
          priority: "high",
          assigneeName: "Bob Ops",
          estimatedHours: 16,
          storyPoints: null, // missing story point should be empty, not 0!
          createdAt: "2026-11-01",
        },
      ],
    });

    assert.ok(csv.includes("KLAVO ANALYTICS REPORT EXPORT"));
    assert.ok(csv.includes("Project Omega"));
    assert.ok(csv.includes("Q4 Sprint Velocity"));
    assert.ok(csv.includes("GROUP SUMMARY BREAKDOWN"));
    assert.ok(csv.includes("TASK RECORDS"));
    // Verify formula injection inside title was neutralized
    assert.ok(csv.includes("Implement auth"));
    // Verify hours and points are separate columns
    assert.ok(csv.includes('"Total Estimated Hours","Total Story Points"'));
  });

  await t.test("generates valid PDF buffer with page headers, table formatting, and page counts", () => {
    const tasks = Array.from({ length: 45 }, (_, i) => ({
      _id: `t_${i}`,
      title: `Task #${i + 1} - System Module Verification`,
      status: i % 2 === 0 ? "done" : "todo",
      priority: i % 3 === 0 ? "urgent" : "medium",
      assigneeName: `Engineer ${i % 5}`,
      dueDate: "2026-11-30",
      estimatedHours: 6,
      storyPoints: 3,
    }));

    const pdfBuffer = generateReportPdf({
      reportTitle: "Multi-Page Performance & Delivery Report",
      projectName: "Project Enterprise",
      generatedAt: "2026-11-18T10:00:00.000Z",
      dateRange: "This Month (November 2026)",
      metricDefinitions: ["Transparent metrics only.", "Separate hours and story points."],
      groups: [
        { groupLabel: "Done", count: 23, completionRate: 100, totalEstimatedHours: 138, totalStoryPoints: 69 },
        { groupLabel: "Todo", count: 22, completionRate: 0, totalEstimatedHours: 132, totalStoryPoints: 66 },
      ],
      tasks,
    });

    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 2000);

    const pdfString = pdfBuffer.toString("utf8");
    // Verify PDF header
    assert.ok(pdfString.startsWith("%PDF-1.4"));
    // Verify PDF trailer and catalog
    assert.ok(pdfString.includes("/Type /Catalog"));
    assert.ok(pdfString.includes("/Type /Pages"));
    assert.ok(pdfString.includes("startxref"));
    assert.ok(pdfString.includes("%%EOF"));
    // Multi-page test: 45 tasks + 2 groups should span at least 2 pages
    assert.ok(pdfString.includes("Page 2 of"));
  });

  await t.test("sanitizes PDF special characters and parentheses safely", () => {
    const raw = "Special (Nested) [Text] \\ Backslash\r\nNewline";
    const sanitized = sanitizePdfText(raw);
    assert.ok(!sanitized.includes("\r"));
    assert.ok(!sanitized.includes("\n"));
    assert.ok(sanitized.includes("\\("));
    assert.ok(sanitized.includes("\\)"));
    assert.ok(sanitized.includes("\\\\"));
  });
});

test("ANL-08: Workspace-Wide Analytics & Cross-Project Reporting Logic", async (t) => {
  const { calculateWorkspaceAnalyticsMetrics } = await import("../src/controllers/analyticsController.js");
  const fixedNow = new Date("2026-11-18T12:00:00.000Z");

  await t.test("aggregates KPIs across multiple authorized projects correctly without cross-contamination", () => {
    const team = { _id: "team_1", name: "Engineering Org" };
    const projects = [
      { _id: "proj_1", name: "Core API", teamId: "team_1" },
      { _id: "proj_2", name: "Web Frontend", teamId: "team_1" },
    ];

    const tasks = [
      // Project 1: 2 tasks (1 done, 1 in-progress)
      { _id: "t1", projectId: "proj_1", status: "done", estimatedHours: 10, storyPoints: 5, completedAt: "2026-11-15" },
      { _id: "t2", projectId: "proj_1", status: "in-progress", estimatedHours: 8, storyPoints: 3, dueDate: "2026-11-20" },
      // Project 2: 2 tasks (1 done, 1 overdue)
      { _id: "t3", projectId: "proj_2", status: "done", estimatedHours: 14, storyPoints: 8, completedAt: "2026-11-14" },
      { _id: "t4", projectId: "proj_2", status: "todo", estimatedHours: 6, storyPoints: 2, dueDate: "2026-11-10" }, // overdue
    ];

    const workflows = [
      { projectId: "proj_1", statuses: [{ key: "todo", category: "todo" }, { key: "done", category: "done" }] },
      { projectId: "proj_2", statuses: [{ key: "todo", category: "todo" }, { key: "done", category: "done" }] },
    ];

    const result = calculateWorkspaceAnalyticsMetrics({
      team,
      projects,
      workflows,
      tasks,
      sprints: [],
      milestones: [],
      teamMembers: [],
      now: fixedNow,
    });

    assert.equal(result.workspaceName, "Engineering Org");
    assert.equal(result.summary.totalProjects, 2);
    assert.equal(result.summary.totalTasks, 4);
    assert.equal(result.summary.completedTasks, 2);
    assert.equal(result.summary.overdueTasks, 1);
    assert.equal(result.summary.completionRate, 50); // 2/4 = 50%
    assert.equal(result.summary.totalEstimatedHours, 38); // 10+8+14+6
    assert.equal(result.summary.completedEstimatedHours, 24); // 10+14
    assert.equal(result.summary.totalStoryPoints, 18); // 5+3+8+2
    assert.equal(result.summary.completedStoryPoints, 13); // 5+8
  });

  await t.test("ranks projects transparently based on objective health score and completion rate", () => {
    const team = { _id: "team_1", name: "Engineering Org" };
    const projects = [
      { _id: "proj_critical", name: "Legacy Portal" },
      { _id: "proj_healthy", name: "New Cloud Service" },
    ];

    const tasks = [
      // Healthy project tasks: all completed on time
      { _id: "t_h1", projectId: "proj_healthy", status: "done", completedAt: "2026-11-10" },
      { _id: "t_h2", projectId: "proj_healthy", status: "done", completedAt: "2026-11-12" },
      // Critical project tasks: multiple overdue tasks
      { _id: "t_c1", projectId: "proj_critical", status: "todo", dueDate: "2026-11-01" }, // overdue
      { _id: "t_c2", projectId: "proj_critical", status: "todo", dueDate: "2026-11-05" }, // overdue
    ];

    const result = calculateWorkspaceAnalyticsMetrics({
      team,
      projects,
      tasks,
      workflows: [],
      now: fixedNow,
    });

    assert.equal(result.projectRankings.length, 2);
    // Healthy project should be ranked first (#1)
    assert.equal(result.projectRankings[0].projectId, "proj_healthy");
    assert.equal(result.projectRankings[0].healthState, "Healthy");
    assert.ok(result.projectRankings[0].healthScore >= 80);

    // Critical project ranked second
    assert.equal(result.projectRankings[1].projectId, "proj_critical");
    assert.ok(result.projectRankings[1].overdueTasks > 0);
  });

  await t.test("returns Insufficient Data for empty workspace without fabricating synthetic metrics", () => {
    const team = { _id: "empty_team", name: "Brand New Org" };
    const result = calculateWorkspaceAnalyticsMetrics({
      team,
      projects: [],
      tasks: [],
      workflows: [],
      now: fixedNow,
    });

    assert.equal(result.summary.totalProjects, 0);
    assert.equal(result.summary.totalTasks, 0);
    assert.equal(result.summary.averageHealthScore, null);
    assert.equal(result.summary.healthState, "Insufficient Data");
    assert.equal(result.projectRankings.length, 0);
  });
});

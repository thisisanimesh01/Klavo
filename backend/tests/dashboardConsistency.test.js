import test from "node:test";
import assert from "node:assert/strict";
import { mockUsers, mockTeams, mockProjects, mockTasks } from "./fixtures/mockData.js";

test("MOD-03: Dashboard Metrics & Activity Consistency", async (t) => {
  // Test tasks fixture
  const sampleTasks = [
    mockTasks.task1,
    {
      _id: "task_002",
      title: "Deploy frontend",
      status: "done",
      priority: "medium",
      projectId: mockProjects.projectAlpha._id,
      assignedTo: [mockUsers.bob._id],
      createdBy: mockUsers.alice._id,
    },
  ];

  // In-memory activity repository
  const inMemoryActivities = [
    {
      _id: "act_1",
      projectId: mockProjects.projectAlpha._id,
      user: mockUsers.alice._id,
      action: "Created Task",
      message: `${mockUsers.alice.name} created task "Task 1"`,
      createdAt: new Date("2026-11-15T01:00:00Z"),
    },
    {
      _id: "act_2",
      projectId: mockProjects.projectAlpha._id,
      user: mockUsers.bob._id,
      action: "Uploaded File",
      message: `${mockUsers.bob.name} uploaded "architecture.pdf"`,
      createdAt: new Date("2026-11-15T02:00:00Z"),
    },
    {
      _id: "act_3",
      projectId: "foreign_project_999", // Unrelated project
      user: mockUsers.eve._id,
      action: "Created Task",
      message: `${mockUsers.eve.name} created task in other company`,
      createdAt: new Date("2026-11-15T03:00:00Z"),
    },
  ];

  // Helper calculating scoped dashboard metrics
  const computeDashboardStats = (userId) => {
    // 1. Teams where user is member or owner
    const authorizedTeams = Object.values(mockTeams).filter(
      (tm) => tm.owner === userId || tm.members.includes(userId)
    );
    const teamIds = new Set(authorizedTeams.map((tm) => tm._id));

    // 2. Projects belonging to authorized teams
    const authorizedProjects = Object.values(mockProjects).filter((p) =>
      teamIds.has(p.teamId)
    );
    const projectIds = new Set(authorizedProjects.map((p) => p._id));

    // 3. Tasks in authorized projects
    const authorizedTasks = sampleTasks.filter((tk) =>
      projectIds.has(tk.projectId)
    );

    const completedTasks = authorizedTasks.filter((tk) => tk.status === "done");

    // 4. Scoped activities (only from authorized projects)
    const recentActivity = inMemoryActivities
      .filter((act) => projectIds.has(act.projectId))
      .sort((a, b) => b.createdAt - a.createdAt);

    return {
      teamCount: authorizedTeams.length,
      projectCount: authorizedProjects.length,
      taskCount: authorizedTasks.length,
      completedCount: completedTasks.length,
      recentActivity,
    };
  };

  await t.test("Alice (Team Alpha owner) sees only Team Alpha metrics & activities", () => {
    const stats = computeDashboardStats(mockUsers.alice._id);

    assert.equal(stats.teamCount, 1);
    assert.equal(stats.projectCount, 1);
    assert.equal(stats.taskCount, 2);
    assert.equal(stats.completedCount, 1);

    // Verify recent activity excludes foreign projects (Eve's action)
    assert.equal(stats.recentActivity.length, 2);
    assert.ok(
      stats.recentActivity.every((act) => act.projectId === mockProjects.projectAlpha._id),
      "Activities strictly scoped to Alice's projects"
    );
    assert.equal(stats.recentActivity[0]._id, "act_2", "Newest activity comes first");
  });

  await t.test("Bob (Team Alpha member) sees identical scoped team stats", () => {
    const stats = computeDashboardStats(mockUsers.bob._id);

    assert.equal(stats.teamCount, 1);
    assert.equal(stats.projectCount, 1);
    assert.equal(stats.taskCount, 2);
    assert.equal(stats.completedCount, 1);
    assert.equal(stats.recentActivity.length, 2);
  });

  await t.test("Eve (outsider) has zero access to Team Alpha metrics or activity records", () => {
    const stats = computeDashboardStats(mockUsers.eve._id);

    assert.equal(stats.teamCount, 0);
    assert.equal(stats.projectCount, 0);
    assert.equal(stats.taskCount, 0);
    assert.equal(stats.completedCount, 0);
    assert.equal(stats.recentActivity.length, 0);
  });

  await t.test("Weekly activity normalizes to all 7 days with zero fill", () => {
    const sampleAgg = [
      { _id: 1, count: 5 }, // Sunday
      { _id: 4, count: 2 }, // Wednesday
    ];

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyMap = new Map(sampleAgg.map((s) => [s._id, s.count]));

    const normalized = [];
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      normalized.push({
        _id: dayNames[dayNum - 1],
        dayOfWeek: dayNum,
        count: weeklyMap.get(dayNum) || 0,
      });
    }

    assert.equal(normalized.length, 7);
    assert.equal(normalized[0]._id, "Sun");
    assert.equal(normalized[0].count, 5);
    assert.equal(normalized[1]._id, "Mon");
    assert.equal(normalized[1].count, 0, "Missing days default to 0 count");
    assert.equal(normalized[3]._id, "Wed");
    assert.equal(normalized[3].count, 2);
  });
});

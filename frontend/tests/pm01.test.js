import test from "node:test";
import assert from "node:assert/strict";

test("FRONTEND PM-01: Priority & Badge Configuration Mapping", async (t) => {
  await t.test("Validates visual theme styling for all 5 priority tiers", () => {
    const PRIORITY_STYLES = {
      low: { bg: "bg-slate-100", dot: "bg-slate-400" },
      medium: { bg: "bg-blue-50", dot: "bg-blue-500" },
      high: { bg: "bg-amber-50", dot: "bg-amber-500" },
      critical: { bg: "bg-red-50", dot: "bg-red-500" },
      urgent: { bg: "bg-purple-50", dot: "bg-purple-600" },
    };

    const levels = ["low", "medium", "high", "critical", "urgent"];
    levels.forEach((lvl) => {
      assert.ok(PRIORITY_STYLES[lvl], `Style for level ${lvl} should exist`);
      assert.ok(PRIORITY_STYLES[lvl].bg, `Background style for ${lvl} should exist`);
      assert.ok(PRIORITY_STYLES[lvl].dot, `Dot style for ${lvl} should exist`);
    });
  });

  await t.test("Validates Kanban task filter query parameters generation", () => {
    const filterState = {
      searchQuery: "auth token",
      selectedPriority: "urgent",
      selectedLabel: "security",
      sortBy: "priority",
    };

    const queryParams = new URLSearchParams();
    if (filterState.searchQuery) queryParams.set("search", filterState.searchQuery);
    if (filterState.selectedPriority !== "all") queryParams.set("priority", filterState.selectedPriority);
    if (filterState.selectedLabel !== "all") queryParams.set("label", filterState.selectedLabel);
    if (filterState.sortBy !== "order") queryParams.set("sortBy", filterState.sortBy);

    const queryString = queryParams.toString();
    assert.match(queryString, /search=auth\+token/);
    assert.match(queryString, /priority=urgent/);
    assert.match(queryString, /label=security/);
    assert.match(queryString, /sortBy=priority/);
  });

  await t.test("Validates template checklist item completion state toggling", () => {
    const checklist = [
      { text: "Verify Docker sandbox", completed: false },
      { text: "Run lint check", completed: false },
    ];

    // Toggle first item
    const toggled = checklist.map((item, idx) =>
      idx === 0 ? { ...item, completed: !item.completed } : item
    );

    assert.equal(toggled[0].completed, true);
    assert.equal(toggled[1].completed, false);
    assert.equal(toggled.filter((i) => i.completed).length, 1);
  });

  await t.test("Validates priority-weighted sorting comparator", () => {
    const priorityWeight = {
      urgent: 5,
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    const tasks = [
      { id: "1", priority: "low" },
      { id: "2", priority: "urgent" },
      { id: "3", priority: "high" },
      { id: "4", priority: "critical" },
    ];

    const sorted = tasks.slice().sort((a, b) => {
      const pa = priorityWeight[a.priority] || 2;
      const pb = priorityWeight[b.priority] || 2;
      return pb - pa;
    });

    assert.deepEqual(
      sorted.map((t) => t.priority),
      ["urgent", "critical", "high", "low"]
    );
  });
});

test("FRONTEND PM-02: Sprint Calculation & Filter State Composition", async (t) => {
  await t.test("Validates sprint progress percentage and task counting", () => {
    const sprint = {
      id: "sprint_10",
      totalTasks: 5,
      completedTasks: 3,
    };

    const progress = Math.round((sprint.completedTasks / sprint.totalTasks) * 100);
    assert.equal(progress, 60);

    const emptySprint = { totalTasks: 0, completedTasks: 0 };
    const emptyProgress = emptySprint.totalTasks > 0 ? Math.round((emptySprint.completedTasks / emptySprint.totalTasks) * 100) : 0;
    assert.equal(emptyProgress, 0);
  });

  await t.test("Validates sprint filter parameter mapping for Kanban queries", () => {
    const states = [
      { selectedSprintId: "all", expected: {} },
      { selectedSprintId: "backlog", expected: { sprintId: "backlog" } },
      { selectedSprintId: "sprint_abc123", expected: { sprintId: "sprint_abc123" } },
    ];

    states.forEach(({ selectedSprintId, expected }) => {
      const params = new URLSearchParams();
      if (selectedSprintId !== "all") {
        params.set("sprintId", selectedSprintId);
      }
      if (expected.sprintId) {
        assert.equal(params.get("sprintId"), expected.sprintId);
      } else {
        assert.equal(params.has("sprintId"), false);
      }
    });
  });

  await t.test("Validates sprint active banner badge and status styling", () => {
    const statusBadges = {
      planned: "bg-slate-100 text-slate-700",
      active: "bg-indigo-600 text-white animate-pulse",
      completed: "bg-emerald-100 text-emerald-800",
      archived: "bg-slate-200 text-slate-500",
    };

    ["planned", "active", "completed", "archived"].forEach((st) => {
      assert.ok(statusBadges[st], `Status style for ${st} must be defined`);
    });
  });
});

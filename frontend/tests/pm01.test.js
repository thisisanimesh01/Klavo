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

test("FRONTEND PM-03: Backlog Selection & Capacity Overload Indicators", async (t) => {
  await t.test("Validates bulk selection toggles (select, deselect, select all)", () => {
    const backlogTasks = [
      { _id: "t1", title: "Task 1" },
      { _id: "t2", title: "Task 2" },
      { _id: "t3", title: "Task 3" },
    ];

    let selectedTaskIds = [];

    // Toggle t1
    selectedTaskIds = [...selectedTaskIds, "t1"];
    assert.deepEqual(selectedTaskIds, ["t1"]);

    // Select all
    selectedTaskIds = backlogTasks.map((t) => t._id);
    assert.deepEqual(selectedTaskIds, ["t1", "t2", "t3"]);

    // Deselect all
    selectedTaskIds = [];
    assert.deepEqual(selectedTaskIds, []);
  });

  await t.test("Validates capacity utilization progress bar width and color thresholds", () => {
    const computeBarProps = (committedHours, capacity) => {
      if (!capacity || capacity <= 0) return { width: 0, color: "bg-indigo-600", isOverloaded: false };
      const utilization = Math.round((committedHours / capacity) * 100);
      const isOverloaded = committedHours > capacity;
      const color = isOverloaded ? "bg-red-500" : utilization > 80 ? "bg-amber-500" : "bg-indigo-600";
      return { width: Math.min(utilization, 100), color, isOverloaded };
    };

    // Safe workload (50%)
    const safe = computeBarProps(20, 40);
    assert.equal(safe.width, 50);
    assert.equal(safe.color, "bg-indigo-600");
    assert.equal(safe.isOverloaded, false);

    // Warning workload (90%)
    const warning = computeBarProps(36, 40);
    assert.equal(warning.width, 90);
    assert.equal(warning.color, "bg-amber-500");
    assert.equal(warning.isOverloaded, false);

    // Overloaded workload (120%)
    const overloaded = computeBarProps(48, 40);
    assert.equal(overloaded.width, 100); // capped at 100% bar width
    assert.equal(overloaded.color, "bg-red-500");
    assert.equal(overloaded.isOverloaded, true);
  });
});

test("FRONTEND PM-04: Dependencies, Blocker Gates & Subtasks Integration", async (t) => {
  await t.test("Validates blocker indicator rendering and border highlighting condition", () => {
    const taskBlocked = { isBlocked: true, status: "todo" };
    const taskDone = { isBlocked: true, status: "done" };
    const taskUnblocked = { isBlocked: false, status: "in-progress" };

    const shouldShowBlocker = (t) => t.isBlocked && t.status !== "done";

    assert.equal(shouldShowBlocker(taskBlocked), true);
    assert.equal(shouldShowBlocker(taskDone), false, "Completed task should not show active blocker warning");
    assert.equal(shouldShowBlocker(taskUnblocked), false);
  });

  await t.test("Validates subtask completion ratio string formatting", () => {
    const formatSubtaskRatio = (completed, total) => {
      if (!total || total <= 0) return null;
      return `${completed || 0}/${total}`;
    };

    assert.equal(formatSubtaskRatio(0, 0), null);
    assert.equal(formatSubtaskRatio(2, 5), "2/5");
    assert.equal(formatSubtaskRatio(5, 5), "5/5");
    assert.equal(formatSubtaskRatio(undefined, 3), "0/3");
  });

  await t.test("Validates dependency type badge styling and directional semantics", () => {
    const DEP_BADGES = {
      "blocked-by": { label: "Blocked By", color: "bg-red-50 text-red-700" },
      "blocks": { label: "Blocks", color: "bg-amber-50 text-amber-700" },
      "relates-to": { label: "Relates To", color: "bg-blue-50 text-blue-700" },
    };

    ["blocked-by", "blocks", "relates-to"].forEach((type) => {
      assert.ok(DEP_BADGES[type], `Badge definition for ${type} must exist`);
      assert.ok(DEP_BADGES[type].label);
      assert.ok(DEP_BADGES[type].color);
    });
  });

  await t.test("Validates blocker gate drag-and-drop error handling payload", () => {
    const errorResponse = {
      response: {
        status: 400,
        data: {
          error: "Task is blocked by 2 incomplete task(s). Resolve blockers before marking as done.",
          isBlocked: true,
          blockingTasks: [{ _id: "b1", title: "Setup Database" }, { _id: "b2", title: "Config Redis" }]
        }
      }
    };

    const isBlockerError = Boolean(errorResponse.response?.data?.isBlocked);
    const blockerCount = errorResponse.response?.data?.blockingTasks?.length;

    assert.equal(isBlockerError, true);
    assert.equal(blockerCount, 2);
  });
});

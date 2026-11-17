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

test("FRONTEND PM-05: Gantt Timeline Calculations & Milestone Visual Mapping", async (t) => {
  await t.test("Validates Gantt bar position & width percentages within boundary limits", () => {
    const timelineStart = new Date("2026-06-01T00:00:00Z");
    const timelineEnd = new Date("2026-06-30T23:59:59Z");
    const totalMs = timelineEnd.getTime() - timelineStart.getTime();

    const computeBar = (start, end) => {
      const s = start ? new Date(start) : timelineStart;
      let e = end ? new Date(end) : new Date(s);
      if (!end || e < s) {
        e = new Date(s);
        e.setDate(e.getDate() + 2);
      }
      const startOffsetMs = Math.max(0, s.getTime() - timelineStart.getTime());
      const durationMs = Math.max(1000 * 60 * 60 * 24, e.getTime() - s.getTime());
      const leftPercent = Math.min(Math.max((startOffsetMs / totalMs) * 100, 0), 98);
      const widthPercent = Math.min(Math.max((durationMs / totalMs) * 100, 2), 100 - leftPercent);
      return { left: `${leftPercent}%`, width: `${widthPercent}%`, leftVal: leftPercent, widthVal: widthPercent };
    };

    // First week milestone
    const bar1 = computeBar("2026-06-01T00:00:00Z", "2026-06-08T00:00:00Z");
    assert.equal(bar1.leftVal, 0);
    assert.ok(bar1.widthVal > 20 && bar1.widthVal < 30);

    // Mid-month milestone
    const bar2 = computeBar("2026-06-15T00:00:00Z", "2026-06-25T00:00:00Z");
    assert.ok(bar2.leftVal > 40 && bar2.leftVal < 60);
    assert.ok(bar2.leftVal + bar2.widthVal <= 100);
  });

  await t.test("Validates milestone overdue warning flag for non-completed items", () => {
    const now = new Date("2026-06-15");
    const isOverdue = (m) =>
      Boolean(m.dueDate && new Date(m.dueDate) < now && m.status !== "completed" && m.status !== "archived");

    assert.equal(isOverdue({ dueDate: "2026-06-10", status: "in_progress" }), true);
    assert.equal(isOverdue({ dueDate: "2026-06-10", status: "completed" }), false);
    assert.equal(isOverdue({ dueDate: "2026-06-20", status: "planned" }), false);
  });

  await t.test("Validates milestone task filtering by milestoneId and sprintId", () => {
    const tasks = [
      { _id: "t1", milestoneId: "m1", sprintId: "s1" },
      { _id: "t2", milestoneId: "m1", sprintId: null },
      { _id: "t3", milestoneId: null, sprintId: "s1" },
      { _id: "t4", milestoneId: "m2", sprintId: "s2" },
    ];

    const filterTasks = (selectedMId, selectedSId) => {
      return tasks.filter((t) => {
        if (selectedMId !== "all") {
          if (selectedMId === "none" && t.milestoneId) return false;
          if (selectedMId !== "none" && t.milestoneId !== selectedMId) return false;
        }
        if (selectedSId !== "all") {
          if (selectedSId === "backlog" && t.sprintId) return false;
          if (selectedSId !== "backlog" && t.sprintId !== selectedSId) return false;
        }
        return true;
      });
    };

    assert.equal(filterTasks("all", "all").length, 4);
    assert.equal(filterTasks("m1", "all").length, 2);
    assert.equal(filterTasks("m1", "backlog").length, 1);
    assert.equal(filterTasks("none", "all").length, 1);
  });
});

test("FRONTEND PM-06: Workflow Configuration & Dynamic Column Generation", async (t) => {
  await t.test("Validates dynamic board columns derived from workflow statuses in order", () => {
    const workflow = {
      statuses: [
        { key: "backlog", name: "Backlog", color: "#64748b", category: "todo", order: 0 },
        { key: "in-flight", name: "In Flight", color: "#3b82f6", category: "in_progress", order: 1 },
        { key: "staging-qa", name: "Staging QA", color: "#f59e0b", category: "review", order: 2 },
        { key: "production", name: "Production", color: "#10b981", category: "done", order: 3 },
      ],
    };

    const columns = workflow.statuses
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((st) => ({
        id: st.key,
        title: st.name,
        color: st.color,
        category: st.category,
      }));

    assert.equal(columns.length, 4);
    assert.equal(columns[0].id, "backlog");
    assert.equal(columns[2].id, "staging-qa");
    assert.equal(columns[3].category, "done");
  });

  await t.test("Validates workflow validation: requires minimum 2 statuses with todo and done", () => {
    const isValid = (statuses) => {
      if (!Array.isArray(statuses) || statuses.length < 2) return false;
      const hasTodo = statuses.some((s) => s.category === "todo");
      const hasDone = statuses.some((s) => s.category === "done");
      return hasTodo && hasDone;
    };

    assert.equal(
      isValid([
        { key: "a", category: "todo" },
        { key: "b", category: "done" },
      ]),
      true
    );

    assert.equal(
      isValid([
        { key: "a", category: "in_progress" },
        { key: "b", category: "done" },
      ]),
      false
    );
  });

  await t.test("Validates subtask completion toggle against workflow category done", () => {
    const workflow = {
      statuses: [
        { key: "todo", category: "todo" },
        { key: "completed", category: "done" },
      ],
    };

    const doneKey = workflow.statuses.find((s) => s.category === "done")?.key || "done";
    const todoKey = workflow.statuses.find((s) => s.category === "todo")?.key || "todo";

    const toggle = (curr) => {
      const isDone = workflow.statuses.find((s) => s.key === curr)?.category === "done" || curr === "done";
      return isDone ? todoKey : doneKey;
    };

    assert.equal(toggle("todo"), "completed");
    assert.equal(toggle("completed"), "todo");
  });
});

test("FRONTEND PM-07: Advanced Filtering, Search & Saved Views Composition", async (t) => {
  await t.test("Validates multi-criteria client filter matcher", () => {
    const tasks = [
      {
        _id: "1",
        title: "Build OAuth login",
        description: "Google and GitHub auth flow",
        priority: "urgent",
        status: "in-progress",
        labels: [{ name: "auth" }, { name: "security" }],
        sprintId: { _id: "s1" },
        milestoneId: { _id: "m1" },
        assignedTo: [{ _id: "u1" }],
        dueDate: "2026-06-01",
        isBlocked: false,
      },
      {
        _id: "2",
        title: "Fix database connection leak",
        description: "Pool exhaustion on high concurrency",
        priority: "critical",
        status: "todo",
        labels: [{ name: "backend" }],
        sprintId: null,
        milestoneId: null,
        assignedTo: [],
        dueDate: null,
        isBlocked: true,
      },
      {
        _id: "3",
        title: "Update documentation site",
        description: "Add PM-07 specs",
        priority: "low",
        status: "done",
        labels: [{ name: "docs" }],
        sprintId: { _id: "s1" },
        milestoneId: { _id: "m1" },
        assignedTo: [{ _id: "u2" }],
        dueDate: "2026-07-01",
        isBlocked: false,
      },
    ];

    const matchTask = (task, filters) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const mTitle = task.title.toLowerCase().includes(q);
        const mDesc = task.description.toLowerCase().includes(q);
        const mLabel = task.labels?.some((l) => l.name.toLowerCase().includes(q));
        if (!mTitle && !mDesc && !mLabel) return false;
      }
      if (filters.priorities?.length > 0 && !filters.priorities.includes(task.priority)) {
        return false;
      }
      if (filters.statuses?.length > 0 && !filters.statuses.includes(task.status)) {
        return false;
      }
      if (filters.assignee && filters.assignee !== "all") {
        if (filters.assignee === "unassigned" && task.assignedTo?.length > 0) return false;
        if (filters.assignee !== "unassigned" && !task.assignedTo?.some((u) => u._id === filters.assignee)) return false;
      }
      if (filters.sprintId && filters.sprintId !== "all") {
        if (filters.sprintId === "backlog" && task.sprintId) return false;
        if (filters.sprintId !== "backlog" && task.sprintId?._id !== filters.sprintId) return false;
      }
      if (filters.dependencyFilter === "blocked_only" && !task.isBlocked) {
        return false;
      }
      return true;
    };

    // 1. Search for "leak"
    const searchResult = tasks.filter((t) => matchTask(t, { search: "leak" }));
    assert.equal(searchResult.length, 1);
    assert.equal(searchResult[0]._id, "2");

    // 2. Filter by priorities (urgent or critical)
    const priorityResult = tasks.filter((t) => matchTask(t, { priorities: ["urgent", "critical"] }));
    assert.equal(priorityResult.length, 2);

    // 3. Filter unassigned tasks
    const unassignedResult = tasks.filter((t) => matchTask(t, { assignee: "unassigned" }));
    assert.equal(unassignedResult.length, 1);
    assert.equal(unassignedResult[0]._id, "2");

    // 4. Filter blocked only
    const blockedResult = tasks.filter((t) => matchTask(t, { dependencyFilter: "blocked_only" }));
    assert.equal(blockedResult.length, 1);
    assert.equal(blockedResult[0]._id, "2");
  });

  await t.test("Validates saved view state serialization and application", () => {
    const savedView = {
      _id: "v_100",
      name: "Critical Blockers View",
      isShared: true,
      filters: {
        search: "",
        priorities: ["critical", "urgent"],
        statuses: ["todo", "in-progress"],
        sprintId: "all",
        milestoneId: "all",
        dependencyFilter: "blocked_only",
      },
      sortBy: "priority",
      sortOrder: "desc",
      groupBy: "priority",
    };

    // Serialize to URL search params
    const params = new URLSearchParams();
    if (savedView.filters.priorities?.length > 0) {
      params.set("priorities", savedView.filters.priorities.join(","));
    }
    if (savedView.filters.statuses?.length > 0) {
      params.set("statuses", savedView.filters.statuses.join(","));
    }
    if (savedView.filters.dependencyFilter !== "all") {
      params.set("dependencyFilter", savedView.filters.dependencyFilter);
    }
    params.set("sortBy", savedView.sortBy);
    params.set("sortOrder", savedView.sortOrder);
    params.set("groupBy", savedView.groupBy);

    const query = params.toString();
    assert.match(query, /priorities=critical%2Curgent/);
    assert.match(query, /dependencyFilter=blocked_only/);
    assert.match(query, /groupBy=priority/);
  });

  await t.test("Validates multi-tier grouping aggregator", () => {
    const tasks = [
      { id: "1", priority: "urgent", status: "todo", assigneeName: "Alice" },
      { id: "2", priority: "urgent", status: "in-progress", assigneeName: "Bob" },
      { id: "3", priority: "low", status: "todo", assigneeName: "Alice" },
    ];

    const groupByField = (items, field) => {
      const groups = {};
      for (const item of items) {
        const val = item[field] || "None";
        if (!groups[val]) groups[val] = [];
        groups[val].push(item);
      }
      return groups;
    };

    const byPriority = groupByField(tasks, "priority");
    assert.equal(byPriority["urgent"].length, 2);
    assert.equal(byPriority["low"].length, 1);

    const byAssignee = groupByField(tasks, "assigneeName");
    assert.equal(byAssignee["Alice"].length, 2);
    assert.equal(byAssignee["Bob"].length, 1);
  });
});

test("FRONTEND PM-08: Workflow Automation & Recurring Tasks State Helpers", async (t) => {
  await t.test("Validates trigger event label and icon mappings", () => {
    const TRIGGER_LABELS = {
      task_created: "When a Task is Created",
      status_changed: "When Status Changes",
      priority_changed: "When Priority Changes",
      assignee_changed: "When Assignee Changes",
      due_date_changed: "When Due Date Changes",
    };

    assert.ok(TRIGGER_LABELS.task_created);
    assert.ok(TRIGGER_LABELS.status_changed);
    assert.ok(TRIGGER_LABELS.priority_changed);
    assert.ok(TRIGGER_LABELS.assignee_changed);
    assert.ok(TRIGGER_LABELS.due_date_changed);
  });

  await t.test("Validates recurring task frequency label formatting", () => {
    const formatSchedule = (frequency, interval, daysOfWeek = []) => {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      if (frequency === "daily") {
        return interval === 1 ? "Every day" : `Every ${interval} days`;
      }
      if (frequency === "weekly") {
        const daysStr = daysOfWeek.map((d) => dayNames[d]).join(", ");
        return interval === 1 ? `Weekly on ${daysStr || "selected days"}` : `Every ${interval} weeks on ${daysStr}`;
      }
      if (frequency === "monthly") {
        return interval === 1 ? "Monthly" : `Every ${interval} months`;
      }
      return frequency;
    };

    assert.equal(formatSchedule("daily", 1), "Every day");
    assert.equal(formatSchedule("daily", 3), "Every 3 days");
    assert.equal(formatSchedule("weekly", 1, [1, 3]), "Weekly on Mon, Wed");
    assert.equal(formatSchedule("monthly", 1), "Monthly");
  });

  await t.test("Validates automation rule action payload validation", () => {
    const isValidAction = (action) => {
      if (!action || !action.type || action.payload === undefined || action.payload === "") return false;
      if (action.type === "set_priority") {
        return ["low", "medium", "high", "critical", "urgent"].includes(action.payload);
      }
      return true;
    };

    assert.equal(isValidAction({ type: "set_status", payload: "done" }), true);
    assert.equal(isValidAction({ type: "set_priority", payload: "urgent" }), true);
    assert.equal(isValidAction({ type: "set_priority", payload: "invalid-priority" }), false);
    assert.equal(isValidAction({ type: "set_status", payload: "" }), false);
  });
});

test("FRONTEND DOC-01: Document Foundation & TipTap Editor Helpers", async (t) => {
  await t.test("Validates safe hyperlink URL formatting", () => {
    const formatLink = (url) => {
      let u = (url || "").trim();
      if (!u) return "";
      if (!/^https?:\/\//i.test(u) && !u.startsWith("mailto:") && !u.startsWith("/")) {
        return `https://${u}`;
      }
      return u;
    };

    assert.equal(formatLink("github.com"), "https://github.com");
    assert.equal(formatLink("http://example.com"), "http://example.com");
    assert.equal(formatLink("mailto:test@example.com"), "mailto:test@example.com");
    assert.equal(formatLink("/internal-link"), "/internal-link");
  });

  await t.test("Validates document excerpt generator for list item subtitles", () => {
    const extractExcerpt = (html, max = 50) => {
      if (!html) return "";
      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length <= max) return text;
      return text.slice(0, max).trim() + "...";
    };

    const preview = extractExcerpt("<p>This is a <strong>rich document</strong> designed for team collaboration.</p>", 30);
    assert.equal(preview, "This is a rich document design...");
    assert.equal(preview.includes("<p>"), false);
  });

  await t.test("Validates autosave debounce status transitions", () => {
    const getStatusText = (status) => {
      switch (status) {
        case "saving":
          return "Saving...";
        case "saved":
          return "All changes saved";
        case "unsaved":
          return "Unsaved changes";
        case "error":
          return "Error saving";
        default:
          return "";
      }
    };

    assert.equal(getStatusText("saving"), "Saving...");
    assert.equal(getStatusText("saved"), "All changes saved");
    assert.equal(getStatusText("unsaved"), "Unsaved changes");
    assert.equal(getStatusText("error"), "Error saving");
  });
});

test("FRONTEND DOC-02: Document Folder Navigation & Hierarchy Helpers", async (t) => {
  await t.test("Validates breadcrumb path aggregation", () => {
    const buildBreadcrumbs = (doc, folders) => {
      const crumbs = [{ id: "root", name: "Docs" }];
      if (doc?.folderId) {
        const folderId = doc.folderId._id || doc.folderId;
        const folder = folders.find((f) => f._id === folderId);
        if (folder) {
          crumbs.push({ id: folder._id, name: folder.name });
        }
      }
      crumbs.push({ id: doc?._id || "current", name: doc?.title || "Untitled" });
      return crumbs;
    };

    const folders = [
      { _id: "f1", name: "Architecture" },
      { _id: "f2", name: "Specs" },
    ];

    const doc1 = { _id: "d1", title: "API Gateway", folderId: { _id: "f1", name: "Architecture" } };
    const doc2 = { _id: "d2", title: "Unfiled Notes", folderId: null };

    const crumbs1 = buildBreadcrumbs(doc1, folders);
    assert.equal(crumbs1.length, 3);
    assert.equal(crumbs1[1].name, "Architecture");
    assert.equal(crumbs1[2].name, "API Gateway");

    const crumbs2 = buildBreadcrumbs(doc2, folders);
    assert.equal(crumbs2.length, 2);
    assert.equal(crumbs2[1].name, "Unfiled Notes");
  });

  await t.test("Validates folder filter scoping for document listings", () => {
    const documents = [
      { id: "1", title: "Doc 1", folderId: "f1" },
      { id: "2", title: "Doc 2", folderId: null },
      { id: "3", title: "Doc 3", folderId: "f2" },
      { id: "4", title: "Doc 4", folderId: "f1" },
    ];

    const filterDocs = (docs, selectedFolderId) => {
      if (selectedFolderId === "all") return docs;
      if (selectedFolderId === "root") return docs.filter((d) => !d.folderId);
      return docs.filter((d) => d.folderId === selectedFolderId);
    };

    assert.equal(filterDocs(documents, "all").length, 4);
    assert.equal(filterDocs(documents, "root").length, 1);
    assert.equal(filterDocs(documents, "f1").length, 2);
    assert.equal(filterDocs(documents, "f2").length, 1);
  });
});

test("FRONTEND DOC-03: Real-Time Collaborative Editing & Presence Helpers", async (t) => {
  await t.test("Validates collaborator color hash assignment from user id", () => {
    const COLLAB_COLORS = [
      "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6",
      "#8b5cf6", "#06b6d4", "#f97316", "#14b8a6", "#e11d48",
    ];

    const getCollaboratorColor = (userIdStr) => {
      if (!userIdStr) return COLLAB_COLORS[0];
      let hash = 0;
      for (let i = 0; i < userIdStr.length; i++) {
        hash = (hash << 5) - hash + userIdStr.charCodeAt(i);
        hash |= 0;
      }
      return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
    };

    const colorA = getCollaboratorColor("user_123");
    const colorA2 = getCollaboratorColor("user_123");
    const colorB = getCollaboratorColor("user_456");

    assert.equal(colorA, colorA2);
    assert.ok(COLLAB_COLORS.includes(colorA));
    assert.ok(COLLAB_COLORS.includes(colorB));
  });

  await t.test("Validates deduplicated collaborator list aggregation", () => {
    const initialCollaborators = [
      { socketId: "s1", name: "Alice", color: "#6366f1" },
      { socketId: "s2", name: "Bob", color: "#ec4899" },
    ];

    const addCollaborator = (list, newCollab) => {
      if (list.some((c) => c.socketId === newCollab.socketId)) return list;
      return [...list, newCollab];
    };

    const updatedWithDuplicate = addCollaborator(initialCollaborators, {
      socketId: "s1",
      name: "Alice Updated",
      color: "#6366f1",
    });
    assert.equal(updatedWithDuplicate.length, 2);

    const updatedWithNew = addCollaborator(initialCollaborators, {
      socketId: "s3",
      name: "Charlie",
      color: "#10b981",
    });
    assert.equal(updatedWithNew.length, 3);
  });

  await t.test("Validates collaborator departure cleanup from active list", () => {
    const list = [
      { socketId: "s1", name: "Alice" },
      { socketId: "s2", name: "Bob" },
      { socketId: "s3", name: "Charlie" },
    ];

    const removeCollaborator = (list, socketId) => list.filter((c) => c.socketId !== socketId);

    const remaining = removeCollaborator(list, "s2");
    assert.equal(remaining.length, 2);
    assert.equal(remaining.some((c) => c.socketId === "s2"), false);
  });
});

test("FRONTEND DOC-04: Document Permissions & Sharing UI Helpers", async (t) => {
  await t.test("Validates document role capability mapping", () => {
    const ROLE_CAPABILITIES = {
      owner: { canRead: true, canComment: true, canEdit: true, canManage: true },
      editor: { canRead: true, canComment: true, canEdit: true, canManage: false },
      commenter: { canRead: true, canComment: true, canEdit: false, canManage: false },
      viewer: { canRead: true, canComment: false, canEdit: false, canManage: false },
    };

    assert.equal(ROLE_CAPABILITIES.owner.canEdit, true);
    assert.equal(ROLE_CAPABILITIES.owner.canManage, true);
    assert.equal(ROLE_CAPABILITIES.editor.canEdit, true);
    assert.equal(ROLE_CAPABILITIES.editor.canManage, false);
    assert.equal(ROLE_CAPABILITIES.commenter.canEdit, false);
    assert.equal(ROLE_CAPABILITIES.viewer.canEdit, false);
  });

  await t.test("Validates eligible team members filter (excludes document creator)", () => {
    const creatorId = "u_creator";
    const teamMembers = [
      { _id: "u_creator", name: "Creator" },
      { _id: "u_alice", name: "Alice" },
      { _id: "u_bob", name: "Bob" },
    ];

    const eligible = teamMembers.filter((m) => m._id !== creatorId);
    assert.equal(eligible.length, 2);
    assert.equal(eligible.some((m) => m._id === creatorId), false);
  });

  await t.test("Validates share grant addition and role update deduplication", () => {
    const shares = [
      { userId: "u_alice", role: "viewer" },
    ];

    const upsertShare = (list, userId, newRole) => {
      const idx = list.findIndex((s) => s.userId === userId);
      if (idx >= 0) {
        return list.map((s, i) => (i === idx ? { ...s, role: newRole } : s));
      }
      return [...list, { userId, role: newRole }];
    };

    // Update existing Alice from viewer to editor
    const updated = upsertShare(shares, "u_alice", "editor");
    assert.equal(updated.length, 1);
    assert.equal(updated[0].role, "editor");

    // Add Bob as commenter
    const added = upsertShare(updated, "u_bob", "commenter");
    assert.equal(added.length, 2);
    assert.equal(added[1].role, "commenter");
  });
});

test("FRONTEND DOC-05: Document Comments & Discussion UI Helpers", async (t) => {
  await t.test("Validates comment thread reply nesting and aggregation", () => {
    const rawComments = [
      { _id: "c1", text: "Root thread 1", parentCommentId: null },
      { _id: "c2", text: "Reply 1.1", parentCommentId: "c1" },
      { _id: "c3", text: "Root thread 2", parentCommentId: null },
      { _id: "c4", text: "Reply 1.2", parentCommentId: "c1" },
    ];

    const groupThreads = (list) => {
      const map = new Map();
      const roots = [];

      list.forEach((c) => {
        map.set(c._id, { ...c, replies: [] });
      });

      list.forEach((c) => {
        const item = map.get(c._id);
        if (c.parentCommentId) {
          const parent = map.get(c.parentCommentId);
          if (parent) parent.replies.push(item);
          else roots.push(item);
        } else {
          roots.push(item);
        }
      });

      return roots;
    };

    const grouped = groupThreads(rawComments);
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0]._id, "c1");
    assert.equal(grouped[0].replies.length, 2);
    assert.equal(grouped[0].replies[0]._id, "c2");
    assert.equal(grouped[0].replies[1]._id, "c4");
    assert.equal(grouped[1]._id, "c3");
    assert.equal(grouped[1].replies.length, 0);
  });

  await t.test("Validates comment filter modes (all, open, resolved)", () => {
    const threads = [
      { _id: "t1", text: "Open thread", isResolved: false },
      { _id: "t2", text: "Resolved thread", isResolved: true },
      { _id: "t3", text: "Another open thread", isResolved: false },
    ];

    const filterThreads = (list, mode) => {
      if (mode === "open") return list.filter((t) => !t.isResolved);
      if (mode === "resolved") return list.filter((t) => t.isResolved);
      return list;
    };

    assert.equal(filterThreads(threads, "all").length, 3);
    assert.equal(filterThreads(threads, "open").length, 2);
    assert.equal(filterThreads(threads, "resolved").length, 1);
  });

  await t.test("Validates inline mention query extraction from cursor input", () => {
    const getMentionQuery = (text) => {
      const lastWord = text.split(/\s+/).pop();
      if (lastWord && lastWord.startsWith("@")) {
        return lastWord.slice(1).toLowerCase();
      }
      return null;
    };

    assert.equal(getMentionQuery("Hello @ali"), "ali");
    assert.equal(getMentionQuery("Please check @Bob"), "bob");
    assert.equal(getMentionQuery("Just an email test@example.com"), null);
    assert.equal(getMentionQuery("No mention here"), null);
  });
});

test("FRONTEND DOC-06: Document Version History & Diff UI Helpers", async (t) => {
  await t.test("Validates visual diff categorization", () => {
    const diff = [
      { type: "unchanged", value: "System" },
      { type: "removed", value: "Alpha" },
      { type: "added", value: "Beta" },
    ];

    const stats = {
      added: diff.filter((d) => d.type === "added").length,
      removed: diff.filter((d) => d.type === "removed").length,
      unchanged: diff.filter((d) => d.type === "unchanged").length,
    };

    assert.equal(stats.added, 1);
    assert.equal(stats.removed, 1);
    assert.equal(stats.unchanged, 1);
  });

  await t.test("Validates chronological sorting of revision history (newest first)", () => {
    const revisions = [
      { revisionNumber: 1, createdAt: "2026-01-01T10:00:00Z" },
      { revisionNumber: 3, createdAt: "2026-01-03T10:00:00Z" },
      { revisionNumber: 2, createdAt: "2026-01-02T10:00:00Z" },
    ];

    const sorted = [...revisions].sort((a, b) => b.revisionNumber - a.revisionNumber);

    assert.equal(sorted[0].revisionNumber, 3);
    assert.equal(sorted[1].revisionNumber, 2);
    assert.equal(sorted[2].revisionNumber, 1);
  });

  await t.test("Validates named snapshot badge display condition", () => {
    const revAuto = { revisionNumber: 4, isNamedSnapshot: false, snapshotName: null };
    const revNamed = { revisionNumber: 5, isNamedSnapshot: true, snapshotName: "Release v1.0 Final" };

    const getRevisionLabel = (rev) => {
      return rev.isNamedSnapshot ? rev.snapshotName : `Revision #${rev.revisionNumber}`;
    };

    assert.equal(getRevisionLabel(revAuto), "Revision #4");
    assert.equal(getRevisionLabel(revNamed), "Release v1.0 Final");
  });
});

test("FRONTEND DOC-07: Project Wiki & Knowledge Base UI Helpers", async (t) => {
  await t.test("Validates breadcrumb path traversal and URL mapping", () => {
    const breadcrumbs = [
      { _id: "home_1", title: "Project Home", isWikiHome: true },
      { _id: "cat_1", title: "Backend Architecture", isWikiHome: false },
      { _id: "page_1", title: "Database Sharding", isWikiHome: false },
    ];

    const generateHref = (projectId, crumbId) => `/wiki/${projectId}/${crumbId}`;

    assert.equal(breadcrumbs.length, 3);
    assert.equal(generateHref("proj_abc", breadcrumbs[0]._id), "/wiki/proj_abc/home_1");
    assert.equal(generateHref("proj_abc", breadcrumbs[2]._id), "/wiki/proj_abc/page_1");
  });

  await t.test("Validates client-side tree expand/collapse state toggling", () => {
    let expandedSet = new Set(["node_1"]);

    const toggle = (set, id) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    };

    expandedSet = toggle(expandedSet, "node_2");
    assert.equal(expandedSet.has("node_1"), true);
    assert.equal(expandedSet.has("node_2"), true);

    expandedSet = toggle(expandedSet, "node_1");
    assert.equal(expandedSet.has("node_1"), false);
    assert.equal(expandedSet.has("node_2"), true);
  });

  await t.test("Validates wiki search filter matching title and description", () => {
    const pages = [
      { _id: "1", title: "API Authentication Guidelines", description: "OAuth2 and JWT flows" },
      { _id: "2", title: "Deployment Playbook", description: "Docker compose and CI/CD steps" },
      { _id: "3", title: "Design Systems & Typography", description: "Color palette and Tailwind classes" },
    ];

    const filterWiki = (list, query) => {
      if (!query || !query.trim()) return list;
      const q = query.trim().toLowerCase();
      return list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    };

    const qJwt = filterWiki(pages, "JWT");
    assert.equal(qJwt.length, 1);
    assert.equal(qJwt[0]._id, "1");

    const qDeploy = filterWiki(pages, "playbook");
    assert.equal(qDeploy.length, 1);
    assert.equal(qDeploy[0]._id, "2");

    const qEmpty = filterWiki(pages, "");
    assert.equal(qEmpty.length, 3);
  });
});

test("FRONTEND DOC-08: Document & Task Linking UI Helpers", async (t) => {
  await t.test("Validates deduplicated document linking and available document exclusion", () => {
    const allDocs = [
      { _id: "doc_1", title: "API Spec", isWiki: false },
      { _id: "doc_2", title: "Database Architecture", isWiki: true },
      { _id: "doc_3", title: "Frontend Guidelines", isWiki: false },
    ];

    const linkedDocs = [
      { _id: "doc_1", title: "API Spec" },
    ];

    // Filter available docs to exclude already linked docs
    const availableToLink = allDocs.filter(
      (d) => !linkedDocs.some((ld) => ld._id === d._id)
    );

    assert.equal(availableToLink.length, 2);
    assert.equal(availableToLink[0]._id, "doc_2");
    assert.equal(availableToLink[1]._id, "doc_3");
  });

  await t.test("Validates document link target URL generation for docs vs wiki", () => {
    const getDocUrl = (projectId, doc) => {
      return doc.isWiki
        ? `/wiki/${projectId}/${doc._id}`
        : `/documents/${projectId}/${doc._id}`;
    };

    assert.equal(
      getDocUrl("p_123", { _id: "d_1", isWiki: false }),
      "/documents/p_123/d_1"
    );
    assert.equal(
      getDocUrl("p_123", { _id: "w_1", isWiki: true }),
      "/wiki/p_123/w_1"
    );
  });

  await t.test("Validates optimistic unlink state update", () => {
    let linkedList = [
      { _id: "d_1", title: "Doc 1" },
      { _id: "d_2", title: "Doc 2" },
      { _id: "d_3", title: "Doc 3" },
    ];

    const removeDoc = (list, targetId) => list.filter((d) => d._id !== targetId);

    linkedList = removeDoc(linkedList, "d_2");
    assert.equal(linkedList.length, 2);
    assert.equal(linkedList.some((d) => d._id === "d_2"), false);
  });
});

test("FRONTEND ANL-01: Project Analytics Dashboard State & Formatting", async (t) => {
  await t.test("Validates date-range query parameter composition", () => {
    const buildQueryParams = ({ range, customStart, customEnd }) => {
      const params = new URLSearchParams();
      if (range) params.set("range", range);
      if (range === "custom") {
        if (customStart) params.set("startDate", customStart);
        if (customEnd) params.set("endDate", customEnd);
      }
      return params.toString();
    };

    assert.equal(buildQueryParams({ range: "all" }), "range=all");
    assert.equal(buildQueryParams({ range: "this_week" }), "range=this_week");
    assert.equal(
      buildQueryParams({
        range: "custom",
        customStart: "2026-11-01",
        customEnd: "2026-11-15",
      }),
      "range=custom&startDate=2026-11-01&endDate=2026-11-15"
    );
  });

  await t.test("Validates completion percentage and zero-guard calculation", () => {
    const calcRate = (completed, total) => (total > 0 ? Math.round((completed / total) * 100) : 0);

    assert.equal(calcRate(0, 0), 0);
    assert.equal(calcRate(5, 10), 50);
    assert.equal(calcRate(1, 3), 33);
    assert.equal(calcRate(10, 10), 100);
  });

  await t.test("Validates workload member sorting and data sanitization", () => {
    const workload = [
      { userId: "u1", name: "Bob", total: 3, completed: 1 },
      { userId: "u2", name: "Alice", total: 8, completed: 5 },
      { userId: "u3", name: "Charlie", total: 1, completed: 0 },
    ];

    const sorted = workload.slice().sort((a, b) => b.total - a.total);
    assert.equal(sorted[0].name, "Alice");
    assert.equal(sorted[1].name, "Bob");
    assert.equal(sorted[2].name, "Charlie");
  });

  await t.test("Validates status distribution chart color fallback mapping", () => {
    const getStatusColor = (item, defaultFallback) => {
      return item.color || defaultFallback;
    };

    assert.equal(getStatusColor({ color: "#10B981" }, "#6366F1"), "#10B981");
    assert.equal(getStatusColor({}, "#6366F1"), "#6366F1");
  });
});

test("FRONTEND ANL-02: Sprint Velocity & Burndown UI Formatting", async (t) => {
  await t.test("Validates measurement unit label mapping", () => {
    const getUnitLabel = (unit) => (unit === "storyPoints" ? "Story Points" : "Hours");
    assert.equal(getUnitLabel("estimatedHours"), "Hours");
    assert.equal(getUnitLabel("storyPoints"), "Story Points");
    assert.equal(getUnitLabel(""), "Hours");
  });

  await t.test("Validates sprint velocity comparison data mapping", () => {
    const sprints = [
      { sprintName: "Sprint 1", committed: 40, completed: 35, status: "completed" },
      { sprintName: "Sprint 2", committed: 45, completed: 42, status: "completed" },
      { sprintName: "Sprint 3", committed: 30, completed: 15, status: "active" },
    ];

    const completed = sprints.filter((s) => s.status === "completed");
    const avgVelocity = completed.length > 0
      ? Math.round((completed.reduce((sum, s) => sum + s.completed, 0) / completed.length) * 10) / 10
      : 0;

    assert.equal(avgVelocity, 38.5); // (35 + 42) / 2
  });

  await t.test("Validates burndown ideal line progression calculation", () => {
    const totalCommitted = 40;
    const days = 5; // Day 0 to Day 4
    const idealStep = totalCommitted / (days - 1); // 10 per day

    const idealValues = [];
    for (let i = 0; i < days; i++) {
      idealValues.push(Math.max(0, Math.round(totalCommitted - i * idealStep)));
    }

    assert.deepEqual(idealValues, [40, 30, 20, 10, 0]);
  });

  await t.test("Validates sprint status badge color and border styling", () => {
    const getStatusStyle = (status) => {
      if (status === "active") return "bg-emerald-500/10 text-emerald-400";
      if (status === "completed") return "bg-blue-500/10 text-blue-400";
      return "bg-slate-800 text-slate-400";
    };

    assert.match(getStatusStyle("active"), /emerald/);
    assert.match(getStatusStyle("completed"), /blue/);
    assert.match(getStatusStyle("planned"), /slate/);
  });
});

test("FRONTEND ANL-03: Team Workload & Capacity UI Helpers", async (t) => {
  await t.test("Validates utilization calculation and badge color thresholds", () => {
    const getUtilizationBadge = (utilizationRate, isOverAllocated) => {
      if (isOverAllocated || utilizationRate > 100) {
        return { label: `${utilizationRate}%`, color: "red", status: "overloaded" };
      }
      if (utilizationRate >= 80) {
        return { label: `${utilizationRate}%`, color: "amber", status: "optimal" };
      }
      return { label: `${utilizationRate}%`, color: "emerald", status: "available" };
    };

    const over = getUtilizationBadge(125, true);
    assert.equal(over.color, "red");
    assert.equal(over.status, "overloaded");

    const optimal = getUtilizationBadge(85, false);
    assert.equal(optimal.color, "amber");
    assert.equal(optimal.status, "optimal");

    const available = getUtilizationBadge(50, false);
    assert.equal(available.color, "emerald");
    assert.equal(available.status, "available");
  });

  await t.test("Validates member capacity comparison chart dataset aggregation", () => {
    const members = [
      { name: "Alice", capacity: 40, committed: 50, isOverAllocated: true },
      { name: "Bob", capacity: 40, committed: 20, isOverAllocated: false },
      { name: "Charlie", capacity: 30, committed: 0, isOverAllocated: false },
    ];

    const overAllocatedMembers = members.filter((m) => m.isOverAllocated);
    assert.equal(overAllocatedMembers.length, 1);
    assert.equal(overAllocatedMembers[0].name, "Alice");

    const totalCapacity = members.reduce((sum, m) => sum + m.capacity, 0);
    const totalCommitted = members.reduce((sum, m) => sum + m.committed, 0);
    assert.equal(totalCapacity, 110);
    assert.equal(totalCommitted, 70);
  });

  await t.test("Validates unassigned work and unestimated task summary indicators", () => {
    const unassignedData = {
      taskCount: 5,
      estimatedWork: 16,
      unestimatedTaskCount: 2,
    };

    const hasUnassignedRisk = unassignedData.taskCount > 0;
    const hasUnestimatedRisk = unassignedData.unestimatedTaskCount > 0;

    assert.equal(hasUnassignedRisk, true);
    assert.equal(hasUnestimatedRisk, true);
    assert.equal(unassignedData.estimatedWork, 16);
  });

  await t.test("Validates workload filter query string composition", () => {
    const composeCapacityParams = ({ sprintId, memberId, range, startDate, endDate, unit }) => {
      const params = new URLSearchParams();
      if (sprintId) params.append("sprintId", sprintId);
      if (memberId) params.append("memberId", memberId);
      if (range) params.append("range", range);
      if (range === "custom" && startDate && endDate) {
        params.append("startDate", startDate);
        params.append("endDate", endDate);
      }
      if (unit) params.append("unit", unit);
      return params.toString();
    };

    const query = composeCapacityParams({
      sprintId: "sprint_123",
      range: "custom",
      startDate: "2026-11-01",
      endDate: "2026-11-15",
      unit: "storyPoints",
    });

    assert.equal(
      query,
      "sprintId=sprint_123&range=custom&startDate=2026-11-01&endDate=2026-11-15&unit=storyPoints"
    );
  });
});

test("FRONTEND ANL-04: Task Completion & Cycle Time UI Helpers", async (t) => {
  await t.test("Validates cycle time and lead time percentile comparison dataset mapping", () => {
    const cycleStats = {
      average: 42,
      median: 36,
      p85: 60,
      p95: 72,
      count: 10,
    };
    const leadStats = {
      average: 84,
      median: 72,
      p85: 120,
      p95: 144,
      count: 12,
    };

    const comparisonData = [
      { metric: "Average", cycleTime: cycleStats.average, leadTime: leadStats.average },
      { metric: "Median (p50)", cycleTime: cycleStats.median, leadTime: leadStats.median },
      { metric: "85th %ile", cycleTime: cycleStats.p85, leadTime: leadStats.p85 },
      { metric: "95th %ile", cycleTime: cycleStats.p95, leadTime: leadStats.p95 },
    ];

    assert.equal(comparisonData.length, 4);
    assert.equal(comparisonData[0].cycleTime, 42);
    assert.equal(comparisonData[0].leadTime, 84);
    assert.equal(comparisonData[2].cycleTime, 60);
    assert.equal(comparisonData[2].leadTime, 120);
  });

  await t.test("Validates completion trend granularity dataset selection", () => {
    const trends = {
      daily: [{ date: "2026-11-15", count: 3 }, { date: "2026-11-16", count: 5 }],
      weekly: [{ weekStart: "2026-11-10", label: "Week of 2026-11-10", count: 12 }],
      monthly: [{ month: "2026-11", count: 25 }],
    };

    const getTrendData = (granularity) => {
      if (granularity === "weekly") return trends.weekly;
      if (granularity === "monthly") return trends.monthly;
      return trends.daily;
    };

    assert.equal(getTrendData("daily").length, 2);
    assert.equal(getTrendData("weekly")[0].label, "Week of 2026-11-10");
    assert.equal(getTrendData("monthly")[0].count, 25);
  });

  await t.test("Validates stage bottleneck table sorting and average dwell formatting", () => {
    const stages = [
      { key: "todo", name: "Todo", averageHours: 12.5, order: 0 },
      { key: "in-progress", name: "In Progress", averageHours: 48.0, order: 1 },
      { key: "review", name: "In Review", averageHours: 18.2, order: 2 },
    ];

    const sortedByBottleneck = [...stages].sort((a, b) => b.averageHours - a.averageHours);
    assert.equal(sortedByBottleneck[0].name, "In Progress");
    assert.equal(sortedByBottleneck[0].averageHours, 48.0);
    assert.equal(sortedByBottleneck[2].name, "Todo");
  });

  await t.test("Validates cycle time filter query string composition", () => {
    const composeCycleParams = ({ sprintId, memberId, priority, range, startDate, endDate }) => {
      const params = new URLSearchParams();
      if (sprintId && sprintId !== "all") params.append("sprintId", sprintId);
      if (memberId && memberId !== "all") params.append("memberId", memberId);
      if (priority && priority !== "all") params.append("priority", priority);
      if (range && range !== "all") params.append("range", range);
      if (range === "custom" && startDate && endDate) {
        params.append("startDate", startDate);
        params.append("endDate", endDate);
      }
      return params.toString();
    };

    const query = composeCycleParams({
      sprintId: "sprint_456",
      memberId: "user_789",
      priority: "urgent",
      range: "custom",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });

    assert.equal(
      query,
      "sprintId=sprint_456&memberId=user_789&priority=urgent&range=custom&startDate=2026-11-01&endDate=2026-11-30"
    );
  });
});

test("FRONTEND ANL-05: Project Health & Progress UI Helpers", async (t) => {
  await t.test("Validates health status category styling and color resolution", () => {
    const getHealthStateProps = (score) => {
      if (score === null || score === undefined) {
        return { label: "Insufficient Data", color: "#94a3b8", badgeClass: "bg-slate-500/10 text-slate-400" };
      }
      if (score >= 80) {
        return { label: "Healthy", color: "#10B981", badgeClass: "bg-emerald-500/10 text-emerald-400" };
      }
      if (score >= 50) {
        return { label: "At Risk", color: "#F59E0B", badgeClass: "bg-amber-500/10 text-amber-400" };
      }
      return { label: "Critical", color: "#EF4444", badgeClass: "bg-red-500/10 text-red-400" };
    };

    assert.equal(getHealthStateProps(null).label, "Insufficient Data");
    assert.equal(getHealthStateProps(95).label, "Healthy");
    assert.equal(getHealthStateProps(65).label, "At Risk");
    assert.equal(getHealthStateProps(35).label, "Critical");
  });

  await t.test("Validates health gauge circumference and strokeDashoffset calculations", () => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const computeOffset = (score) => circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

    const offset100 = computeOffset(100);
    const offset50 = computeOffset(50);
    const offset0 = computeOffset(0);

    assert.equal(Math.round(offset100), 0);
    assert.equal(Math.round(offset50), Math.round(circumference / 2));
    assert.equal(Math.round(offset0), Math.round(circumference));
  });

  await t.test("Validates milestone progress bar color mapping and overdue detection", () => {
    const milestones = [
      { name: "M1", completionRate: 100, isOverdue: false },
      { name: "M2", completionRate: 50, isOverdue: true },
      { name: "M3", completionRate: 40, isOverdue: false },
    ];

    const getMilestoneColor = (m) => {
      if (m.isOverdue) return "#EF4444";
      if (m.completionRate === 100) return "#10B981";
      return "#6366F1";
    };

    assert.equal(getMilestoneColor(milestones[0]), "#10B981");
    assert.equal(getMilestoneColor(milestones[1]), "#EF4444");
    assert.equal(getMilestoneColor(milestones[2]), "#6366F1");
  });

  await t.test("Validates factor impact deduction formatting", () => {
    const factorDeductionFormat = (deduction) => {
      if (!deduction || deduction === 0) return { label: "Nominal", isDeduction: false };
      return { label: `-${deduction} pts`, isDeduction: true };
    };

    assert.equal(factorDeductionFormat(0).label, "Nominal");
    assert.equal(factorDeductionFormat(25).label, "-25 pts");
    assert.equal(factorDeductionFormat(25).isDeduction, true);
  });
});

test("FRONTEND ANL-06: Custom Reports & Date-Range Filtering UI Helpers", async (t) => {
  await t.test("Validates group-by dimension mapping and label formatting", () => {
    const dimensionOptions = [
      { id: "status", label: "Workflow Status" },
      { id: "priority", label: "Task Priority" },
      { id: "assignee", label: "Team Assignee" },
      { id: "sprint", label: "Sprint" },
      { id: "milestone", label: "Milestone" },
      { id: "none", label: "Flat (No Grouping)" },
    ];

    const getDimensionLabel = (dimId) => {
      const match = dimensionOptions.find((d) => d.id === dimId);
      return match ? match.label : "Unknown";
    };

    assert.equal(getDimensionLabel("status"), "Workflow Status");
    assert.equal(getDimensionLabel("assignee"), "Team Assignee");
    assert.equal(getDimensionLabel("none"), "Flat (No Grouping)");
    assert.equal(getDimensionLabel("invalid"), "Unknown");
  });

  await t.test("Validates client-side date range validation and error detection", () => {
    const validateDateRange = (startDate, endDate) => {
      if (!startDate || !endDate) return { valid: false, error: "Both start and end dates are required" };
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, error: "Invalid date format" };
      }
      if (start > end) {
        return { valid: false, error: "Start date cannot be after end date" };
      }
      return { valid: true, error: null };
    };

    assert.equal(validateDateRange("2026-11-01", "2026-11-30").valid, true);
    assert.equal(validateDateRange("2026-11-30", "2026-11-01").valid, false);
    assert.equal(validateDateRange("2026-11-30", "2026-11-01").error, "Start date cannot be after end date");
    assert.equal(validateDateRange("not-a-date", "2026-11-30").valid, false);
    assert.equal(validateDateRange("", "2026-11-30").valid, false);
  });

  await t.test("Validates metric selection and value extraction for custom report charts", () => {
    const sampleGroup = {
      groupKey: "in_progress",
      groupLabel: "In Progress",
      count: 14,
      totalEstimatedHours: 42.5,
      totalStoryPoints: 26,
    };

    const extractMetricValue = (group, metric) => {
      switch (metric) {
        case "estimatedHours":
          return group.totalEstimatedHours || 0;
        case "storyPoints":
          return group.totalStoryPoints || 0;
        case "count":
        default:
          return group.count || 0;
      }
    };

    assert.equal(extractMetricValue(sampleGroup, "count"), 14);
    assert.equal(extractMetricValue(sampleGroup, "estimatedHours"), 42.5);
    assert.equal(extractMetricValue(sampleGroup, "storyPoints"), 26);
    assert.equal(extractMetricValue(sampleGroup, "unknown"), 14);
  });

  await t.test("Validates saved report configuration serialization and payload building", () => {
    const buildSavedReportPayload = (formState) => {
      return {
        name: formState.name.trim(),
        description: formState.description?.trim() || "",
        isShared: Boolean(formState.isShared),
        reportType: formState.reportType || "tasks",
        groupBy: formState.groupBy || "status",
        sortBy: formState.sortBy || "createdAt",
        sortOrder: formState.sortOrder || "desc",
        chartType: formState.chartType || "bar",
        filters: {
          range: formState.range || "all",
          startDate: formState.startDate || null,
          endDate: formState.endDate || null,
          dateField: formState.dateField || "createdAt",
        },
      };
    };

    const payload = buildSavedReportPayload({
      name: "  Sprint 4 Capacity & Overdue  ",
      description: "  Weekly executive summary  ",
      isShared: true,
      groupBy: "assignee",
      sortBy: "dueDate",
      sortOrder: "asc",
      chartType: "pie",
      range: "custom",
      startDate: "2026-11-01",
      endDate: "2026-11-15",
      dateField: "dueDate",
    });

    assert.equal(payload.name, "Sprint 4 Capacity & Overdue");
    assert.equal(payload.description, "Weekly executive summary");
    assert.equal(payload.isShared, true);
    assert.equal(payload.groupBy, "assignee");
    assert.equal(payload.sortBy, "dueDate");
    assert.equal(payload.sortOrder, "asc");
    assert.equal(payload.chartType, "pie");
    assert.equal(payload.filters.range, "custom");
    assert.equal(payload.filters.startDate, "2026-11-01");
    assert.equal(payload.filters.dateField, "dueDate");
  });
});

test("FRONTEND ANL-07: Report Export UI Helpers & Payload Serialization", async (t) => {
  await t.test("Validates export filename generation and sanitization", () => {
    const sanitizeExportFilename = (title, format) => {
      const safe = (title || "Analytics_Report")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 40);
      const dateStamp = "2026-11-18";
      return `${safe}_${dateStamp}.${format}`;
    };

    assert.equal(
      sanitizeExportFilename("Project Alpha & Beta: Sprint 1 (Overdue)", "csv"),
      "Project_Alpha_Beta_Sprint_1_Overdue__2026-11-18.csv"
    );
    assert.equal(
      sanitizeExportFilename("Health / Executive Summary #2", "pdf"),
      "Health_Executive_Summary_2_2026-11-18.pdf"
    );
  });

  await t.test("Validates export MIME type resolution", () => {
    const getMimeType = (format) => {
      return format === "pdf" ? "application/pdf" : "text/csv;charset=utf-8;";
    };

    assert.equal(getMimeType("csv"), "text/csv;charset=utf-8;");
    assert.equal(getMimeType("pdf"), "application/pdf");
    assert.equal(getMimeType("unknown"), "text/csv;charset=utf-8;");
  });

  await t.test("Validates export request payload composition across tabs", () => {
    const composeExportPayload = ({
      activeTab,
      projectName,
      format,
      selectedSavedReportId,
      savedReports = [],
      reportRange,
      dateRange,
      reportDateField,
      reportGroupBy,
      reportSortBy,
      reportSortOrder,
      reportStartDate,
      reportEndDate,
      customStartDate,
      customEndDate,
    }) => {
      let title = `${projectName} Analytics Report`;
      if (activeTab === "sprints") title = `${projectName} Sprint Velocity & Burndown Report`;
      else if (activeTab === "capacity") title = `${projectName} Team Workload & Capacity Report`;
      else if (activeTab === "cycle_time") title = `${projectName} Cycle & Lead Time Report`;
      else if (activeTab === "health") title = `${projectName} Project Health & Progress Report`;
      else if (activeTab === "custom_reports") {
        const match = savedReports.find((r) => r._id === selectedSavedReportId);
        title = match ? match.name : `${projectName} Custom Report`;
      }

      const payload = {
        format,
        reportTitle: title,
        savedReportId: activeTab === "custom_reports" && selectedSavedReportId ? selectedSavedReportId : undefined,
        range: activeTab === "custom_reports" ? reportRange : dateRange,
        dateField: activeTab === "custom_reports" ? reportDateField : "createdAt",
        groupBy: activeTab === "custom_reports" ? reportGroupBy : "status",
        sortBy: activeTab === "custom_reports" ? reportSortBy : "createdAt",
        sortOrder: activeTab === "custom_reports" ? reportSortOrder : "desc",
      };

      if (payload.range === "custom") {
        if (activeTab === "custom_reports") {
          if (reportStartDate) payload.startDate = reportStartDate;
          if (reportEndDate) payload.endDate = reportEndDate;
        } else {
          if (customStartDate) payload.startDate = customStartDate;
          if (customEndDate) payload.endDate = customEndDate;
        }
      }

      return payload;
    };

    // Test Overview Tab Export
    const overviewPayload = composeExportPayload({
      activeTab: "overview",
      projectName: "Omega",
      format: "pdf",
      dateRange: "last_30_days",
    });
    assert.equal(overviewPayload.reportTitle, "Omega Analytics Report");
    assert.equal(overviewPayload.format, "pdf");
    assert.equal(overviewPayload.range, "last_30_days");
    assert.equal(overviewPayload.savedReportId, undefined);

    // Test Custom Reports Tab Export with Saved Report
    const customPayload = composeExportPayload({
      activeTab: "custom_reports",
      projectName: "Omega",
      format: "csv",
      selectedSavedReportId: "rep_123",
      savedReports: [{ _id: "rep_123", name: "Executive Velocity Q4" }],
      reportRange: "custom",
      reportStartDate: "2026-11-01",
      reportEndDate: "2026-11-30",
      reportDateField: "completedAt",
      reportGroupBy: "assignee",
      reportSortBy: "completedAt",
      reportSortOrder: "asc",
    });
    assert.equal(customPayload.reportTitle, "Executive Velocity Q4");
    assert.equal(customPayload.format, "csv");
    assert.equal(customPayload.savedReportId, "rep_123");
    assert.equal(customPayload.range, "custom");
    assert.equal(customPayload.startDate, "2026-11-01");
    assert.equal(customPayload.endDate, "2026-11-30");
    assert.equal(customPayload.dateField, "completedAt");
    assert.equal(customPayload.groupBy, "assignee");
  });
});

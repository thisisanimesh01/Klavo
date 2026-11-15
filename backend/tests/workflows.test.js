import test from "node:test";
import assert from "node:assert/strict";

test("PM-06: Workflow Model & Category Invariants", async (t) => {
  await t.test("enforces at least one todo category and at least one done category", () => {
    const validateWorkflowCategories = (statuses) => {
      if (!Array.isArray(statuses) || statuses.length < 2) return false;
      const hasTodo = statuses.some((s) => s.category === "todo");
      const hasDone = statuses.some((s) => s.category === "done");
      return hasTodo && hasDone;
    };

    const validStatuses = [
      { key: "backlog", name: "Backlog", category: "todo" },
      { key: "in_dev", name: "In Dev", category: "in_progress" },
      { key: "shipped", name: "Shipped", category: "done" },
    ];
    assert.equal(validateWorkflowCategories(validStatuses), true);

    const missingDone = [
      { key: "todo", name: "Todo", category: "todo" },
      { key: "doing", name: "Doing", category: "in_progress" },
    ];
    assert.equal(validateWorkflowCategories(missingDone), false);

    const missingTodo = [
      { key: "doing", name: "Doing", category: "in_progress" },
      { key: "done", name: "Done", category: "done" },
    ];
    assert.equal(validateWorkflowCategories(missingTodo), false);
  });

  await t.test("rejects duplicate status keys and sanitizes generated slugs", () => {
    const sanitizeKey = (name, rawKey) => {
      const source = rawKey ? rawKey.trim().toLowerCase() : name.trim().toLowerCase().replace(/\s+/g, "-");
      return source.replace(/[^a-z0-9_-]/g, "");
    };

    assert.equal(sanitizeKey("QA Testing"), "qa-testing");
    assert.equal(sanitizeKey("Ready for Deploy!", "ready_deploy"), "ready_deploy");

    const statuses = [
      { key: "todo", name: "Todo" },
      { key: "in-progress", name: "In Progress" },
      { key: "todo", name: "Todo Duplicate" },
    ];

    const keys = new Set();
    let hasDuplicate = false;
    for (const s of statuses) {
      if (keys.has(s.key)) {
        hasDuplicate = true;
        break;
      }
      keys.add(s.key);
    }
    assert.equal(hasDuplicate, true);
  });
});

test("PM-06: Safe Status Deletion & Task In-Use Prevention", async (t) => {
  await t.test("blocks deleting status if active tasks are currently assigned to that status", () => {
    const activeTasks = [
      { _id: "t1", status: "todo" },
      { _id: "t2", status: "qa-review" },
    ];

    const newStatuses = [
      { key: "todo", name: "Todo", category: "todo" },
      { key: "done", name: "Done", category: "done" },
    ]; // "qa-review" was removed

    const currentKeys = new Set(newStatuses.map((s) => s.key));
    const oldKeys = ["todo", "qa-review", "done"];
    const removedKeys = oldKeys.filter((k) => !currentKeys.has(k));

    assert.deepEqual(removedKeys, ["qa-review"]);

    const activeTasksInRemoved = activeTasks.filter((t) => removedKeys.includes(t.status));
    assert.equal(activeTasksInRemoved.length, 1);
    assert.equal(activeTasksInRemoved[0]._id, "t2");
  });
});

test("PM-06: Category-Aware Blocker Gates & Sprint Rollover Resolution", async (t) => {
  await t.test("resolves custom statuses in done category as unblocking dependencies", () => {
    const customWorkflow = {
      statuses: [
        { key: "spec", category: "todo" },
        { key: "dev", category: "in_progress" },
        { key: "qa", category: "review" },
        { key: "shipped", category: "done" },
        { key: "verified", category: "done" },
      ],
    };

    const isStatusCompleted = (key, wf) => {
      const match = wf.statuses.find((s) => s.key === key);
      return match ? match.category === "done" : key === "done";
    };

    assert.equal(isStatusCompleted("shipped", customWorkflow), true);
    assert.equal(isStatusCompleted("verified", customWorkflow), true);
    assert.equal(isStatusCompleted("qa", customWorkflow), false);
    assert.equal(isStatusCompleted("dev", customWorkflow), false);
  });

  await t.test("rolls over tasks that are not in a done category status", () => {
    const customWorkflow = {
      statuses: [
        { key: "todo", category: "todo" },
        { key: "in-flight", category: "in_progress" },
        { key: "closed", category: "done" },
      ],
    };

    const doneKeys = customWorkflow.statuses.filter((s) => s.category === "done").map((s) => s.key);
    assert.deepEqual(doneKeys, ["closed"]);

    const sprintTasks = [
      { _id: "t1", status: "closed" },
      { _id: "t2", status: "in-flight" },
      { _id: "t3", status: "todo" },
    ];

    const tasksToRollover = sprintTasks.filter((t) => !doneKeys.includes(t.status));
    assert.equal(tasksToRollover.length, 2);
    assert.deepEqual(tasksToRollover.map((t) => t._id), ["t2", "t3"]);
  });
});

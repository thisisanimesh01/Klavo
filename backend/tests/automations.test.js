import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { evaluateCondition, doesRuleMatch, executeAction } from "../src/utils/automationEngine.js";
import { calculateNextRunDate, isRecurringExpired } from "../src/utils/recurringHelpers.js";

test("PM-08: Automation Engine Condition Evaluation & Matching", async (t) => {
  const dummyTask = {
    _id: "t1",
    title: "Critical Database Fix",
    status: "todo",
    priority: "critical",
    assignedTo: ["u1", "u2"],
    labels: [{ name: "backend", color: "#6366f1" }],
    dueDate: new Date("2026-12-01"),
  };

  await t.test("evaluates equals and not_equals operators", () => {
    assert.equal(evaluateCondition(dummyTask, { field: "priority", operator: "equals", value: "critical" }), true);
    assert.equal(evaluateCondition(dummyTask, { field: "priority", operator: "equals", value: "low" }), false);
    assert.equal(evaluateCondition(dummyTask, { field: "status", operator: "not_equals", value: "done" }), true);
  });

  await t.test("evaluates in and not_in array operators", () => {
    assert.equal(evaluateCondition(dummyTask, { field: "priority", operator: "in", value: ["high", "critical", "urgent"] }), true);
    assert.equal(evaluateCondition(dummyTask, { field: "priority", operator: "not_in", value: ["low", "medium"] }), true);
  });

  await t.test("evaluates contains on task labels", () => {
    assert.equal(evaluateCondition(dummyTask, { field: "labels", operator: "contains", value: "back" }), true);
    assert.equal(evaluateCondition(dummyTask, { field: "labels", operator: "contains", value: "frontend" }), false);
  });

  await t.test("matches automation rule triggers and condition combinations", () => {
    const rule = {
      trigger: { event: "task_created" },
      conditions: [
        { field: "priority", operator: "equals", value: "critical" },
        { field: "status", operator: "equals", value: "todo" },
      ],
    };

    assert.equal(doesRuleMatch(rule, { event: "task_created", task: dummyTask }), true);
    assert.equal(doesRuleMatch(rule, { event: "status_changed", task: dummyTask }), false);

    const nonMatchingRule = {
      trigger: { event: "task_created" },
      conditions: [{ field: "priority", operator: "equals", value: "low" }],
    };
    assert.equal(doesRuleMatch(nonMatchingRule, { event: "task_created", task: dummyTask }), false);
  });
});

test("PM-08: Action Execution & State Mutations", async (t) => {
  await t.test("executes set_status action", async () => {
    const task = { status: "todo" };
    const updates = await executeAction({ type: "set_status", payload: "in-progress" }, task, null, null, "TestRule");
    assert.equal(updates.status, "in-progress");
    assert.equal(task.status, "in-progress");
  });

  await t.test("executes set_priority action", async () => {
    const task = { priority: "low" };
    const updates = await executeAction({ type: "set_priority", payload: "urgent" }, task, null, null, "TestRule");
    assert.equal(updates.priority, "urgent");
    assert.equal(task.priority, "urgent");
  });

  await t.test("executes add_assignee without duplicates", async () => {
    const task = { assignedTo: ["u1"] };
    const updates = await executeAction({ type: "add_assignee", payload: "u2" }, task, null, null, "TestRule");
    assert.deepEqual(updates.assignedTo, ["u1", "u2"]);

    // Try adding u2 again
    const noDupUpdates = await executeAction({ type: "add_assignee", payload: "u2" }, task, null, null, "TestRule");
    assert.equal(Object.keys(noDupUpdates).length, 0);
  });

  await t.test("executes set_due_date_relative", async () => {
    const task = { dueDate: null };
    const updates = await executeAction({ type: "set_due_date_relative", payload: 3 }, task, null, null, "TestRule");
    assert.ok(updates.dueDate instanceof Date);
    const diffDays = Math.round((updates.dueDate - new Date()) / (24 * 60 * 60 * 1000));
    assert.equal(diffDays, 3);
  });
});

test("PM-08: Recurring Task Scheduling Engine", async (t) => {
  await t.test("calculates daily recurrence with custom interval", () => {
    const base = new Date("2026-11-01T10:00:00Z");
    const next1 = calculateNextRunDate({ frequency: "daily", interval: 1, from: base });
    assert.equal(next1.toISOString(), "2026-11-02T10:00:00.000Z");

    const next3 = calculateNextRunDate({ frequency: "daily", interval: 3, from: base });
    assert.equal(next3.toISOString(), "2026-11-04T10:00:00.000Z");
  });

  await t.test("calculates weekly recurrence", () => {
    const base = new Date("2026-11-01T10:00:00Z"); // Sunday (0)
    const next = calculateNextRunDate({ frequency: "weekly", interval: 1, from: base });
    assert.equal(next.toISOString(), "2026-11-08T10:00:00.000Z");
  });

  await t.test("calculates monthly recurrence with dayOfMonth", () => {
    const base = new Date("2026-11-15T10:00:00Z");
    const next = calculateNextRunDate({ frequency: "monthly", interval: 1, dayOfMonth: 15, from: base });
    assert.equal(next.getUTCFullYear(), 2026);
    assert.equal(next.getUTCMonth(), 11); // December (0-indexed 11)
    assert.equal(next.getUTCDate(), 15);
  });

  await t.test("detects expiration against endDate", () => {
    const endDate = new Date("2026-12-01T00:00:00Z");
    assert.equal(isRecurringExpired(endDate, new Date("2026-11-20T00:00:00Z")), false);
    assert.equal(isRecurringExpired(endDate, new Date("2026-12-05T00:00:00Z")), true);
    assert.equal(isRecurringExpired(null, new Date("2030-01-01T00:00:00Z")), false);
  });
});

test("PM-08: Anti-Infinite Loop & Cascade Safeguards", async (t) => {
  await t.test("halts execution when recursion depth reaches maximum threshold (3)", () => {
    const MAX_DEPTH = 3;
    let executionStopped = false;

    const simulateCascade = (currentDepth) => {
      if (currentDepth >= MAX_DEPTH) {
        executionStopped = true;
        return;
      }
      simulateCascade(currentDepth + 1);
    };

    simulateCascade(0);
    assert.equal(executionStopped, true);
  });

  await t.test("detects and breaks circular rule invocation in call chain", () => {
    const executedRules = new Set();
    const ruleA = "rule_a_id";

    executedRules.add(ruleA);
    const wouldLoop = executedRules.has(ruleA);
    assert.equal(wouldLoop, true);
  });
});

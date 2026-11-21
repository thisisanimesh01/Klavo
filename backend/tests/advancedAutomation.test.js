import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  evaluateCondition,
  doesRuleMatch,
  executeAction,
  simulateAutomationRule,
} from "../src/utils/automationEngine.js";

test("AUTO-01: Advanced Condition Evaluation & Logical Branching (AND/OR)", async (t) => {
  const dummyTask = {
    _id: "task_1001",
    title: "Implement Kafka Message Queue",
    status: "todo",
    priority: "high",
    assignedTo: ["user_abc"],
    labels: [{ name: "backend", color: "#6366f1" }],
    dueDate: new Date("2026-12-15"),
  };

  await t.test("evaluates title contains operator", () => {
    assert.equal(evaluateCondition(dummyTask, { field: "title", operator: "contains", value: "kafka" }), true);
    assert.equal(evaluateCondition(dummyTask, { field: "title", operator: "contains", value: "frontend" }), false);
  });

  await t.test("matches rules with conditionMatchMode: AND", () => {
    const ruleAnd = {
      trigger: { event: "task_created" },
      conditionMatchMode: "AND",
      conditions: [
        { field: "priority", operator: "equals", value: "high" },
        { field: "status", operator: "equals", value: "todo" },
      ],
    };
    assert.equal(doesRuleMatch(ruleAnd, { event: "task_created", task: dummyTask }), true);

    const ruleAndFailing = {
      trigger: { event: "task_created" },
      conditionMatchMode: "AND",
      conditions: [
        { field: "priority", operator: "equals", value: "high" },
        { field: "status", operator: "equals", value: "in-progress" }, // fails
      ],
    };
    assert.equal(doesRuleMatch(ruleAndFailing, { event: "task_created", task: dummyTask }), false);
  });

  await t.test("matches rules with conditionMatchMode: OR", () => {
    const ruleOr = {
      trigger: { event: "task_created" },
      conditionMatchMode: "OR",
      conditions: [
        { field: "priority", operator: "equals", value: "low" }, // fails
        { field: "status", operator: "equals", value: "todo" }, // passes
      ],
    };
    assert.equal(doesRuleMatch(ruleOr, { event: "task_created", task: dummyTask }), true);

    const ruleOrFailing = {
      trigger: { event: "task_created" },
      conditionMatchMode: "OR",
      conditions: [
        { field: "priority", operator: "equals", value: "low" },
        { field: "status", operator: "equals", value: "done" },
      ],
    };
    assert.equal(doesRuleMatch(ruleOrFailing, { event: "task_created", task: dummyTask }), false);
  });
});

test("AUTO-01: Multi-Action Handlers (Webhooks, Slack, Subtasks)", async (t) => {
  await t.test("executes dispatch_webhook action simulation", async () => {
    const task = { _id: "t1", title: "Task 1", projectId: "p1", workspaceId: "w1" };
    const updates = await executeAction(
      {
        type: "dispatch_webhook",
        payload: { event: "task.alert", data: { reason: "Urgent fix" } },
      },
      task,
      null,
      null,
      "WebhookRule",
      { isSimulation: true }
    );
    assert.deepEqual(updates, {});
  });

  await t.test("executes send_slack_alert action simulation gracefully", async () => {
    const task = { _id: "t1", title: "Task 1", projectId: "p1" };
    let fetched = false;
    const updates = await executeAction(
      {
        type: "send_slack_alert",
        payload: {
          webhookUrl: "https://hooks.slack.com/services/T00/B00/X00",
          message: "Task mutated",
        },
      },
      task,
      null,
      null,
      "SlackRule",
      {
        isSimulation: false,
        fetchFn: async () => {
          fetched = true;
          return { ok: true, status: 200 };
        },
      }
    );
    assert.equal(fetched, true);
    assert.deepEqual(updates, {});
  });
});

test("AUTO-01: Dry-Run Simulation Engine (simulateAutomationRule)", async (t) => {
  const dummyTask = {
    _id: "task_test_01",
    title: "Production Outage Investigation",
    status: "todo",
    priority: "critical",
    assignedTo: [],
    labels: [{ name: "incident", color: "#ef4444" }],
  };

  await t.test("predicts primary actions when conditions match", async () => {
    const rule = {
      _id: "rule_01",
      name: "Auto-escalate incidents",
      conditionMatchMode: "AND",
      conditions: [
        { field: "priority", operator: "equals", value: "critical" },
      ],
      actions: [
        { type: "set_status", payload: "in-progress" },
        { type: "set_due_date_relative", payload: 2 },
      ],
      elseActions: [
        { type: "set_status", payload: "backlog" },
      ],
    };

    const result = await simulateAutomationRule(rule, dummyTask);
    assert.equal(result.branchTaken, "actions");
    assert.equal(result.consolidatedUpdates.status, "in-progress");
    assert.ok(result.consolidatedUpdates.dueDate instanceof Date);
    assert.equal(result.simulatedActions.length, 2);
    assert.equal(result.simulatedActions[0].status, "predicted_success");
  });

  await t.test("predicts elseActions when conditions do not match (Branching)", async () => {
    const rule = {
      _id: "rule_02",
      name: "Route non-critical tasks",
      conditionMatchMode: "AND",
      conditions: [
        { field: "priority", operator: "equals", value: "low" }, // will fail
      ],
      actions: [
        { type: "set_status", payload: "done" },
      ],
      elseActions: [
        { type: "set_priority", payload: "high" },
      ],
    };

    const result = await simulateAutomationRule(rule, dummyTask);
    assert.equal(result.branchTaken, "elseActions");
    assert.equal(result.consolidatedUpdates.priority, "high");
    assert.equal(result.simulatedActions.length, 1);
  });
});

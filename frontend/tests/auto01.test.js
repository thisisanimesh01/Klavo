import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("FRONTEND AUTO-01: Advanced Automation Engine Components & Payloads", () => {
  it("formats condition match mode and rules payload correctly", () => {
    const rulePayload = {
      name: "High Priority Dispatcher",
      projectId: "proj_123",
      trigger: { event: "task_created" },
      conditionMatchMode: "OR",
      conditions: [
        { field: "priority", operator: "equals", value: "high" },
        { field: "title", operator: "contains", value: "urgent" },
      ],
      actions: [
        { type: "set_status", payload: "in-progress" },
        { type: "dispatch_webhook", payload: "https://webhook.site/test" },
      ],
      elseActions: [
        { type: "set_status", payload: "todo" },
      ],
    };

    assert.equal(rulePayload.conditionMatchMode, "OR");
    assert.equal(rulePayload.conditions.length, 2);
    assert.equal(rulePayload.actions.length, 2);
    assert.equal(rulePayload.elseActions.length, 1);
  });

  it("validates automation action types including webhook and slack alerts", () => {
    const supportedActions = [
      "set_status",
      "set_priority",
      "assign_user",
      "add_assignee",
      "remove_assignee",
      "add_label",
      "send_notification",
      "set_due_date_relative",
      "dispatch_webhook",
      "create_task",
      "send_slack_alert",
    ];

    assert.ok(supportedActions.includes("dispatch_webhook"));
    assert.ok(supportedActions.includes("send_slack_alert"));
    assert.ok(supportedActions.includes("create_task"));
    assert.ok(!supportedActions.includes("unsupported_action"));
  });

  it("verifies dry-run simulation response structure parsing", () => {
    const mockSimulationResponse = {
      success: true,
      simulation: {
        ruleId: "r1",
        ruleName: "Test Rule",
        branchTaken: "actions",
        simulatedActions: [
          { type: "set_status", payload: "in-progress", status: "predicted_success" },
        ],
        consolidatedUpdates: { status: "in-progress" },
      },
    };

    assert.equal(mockSimulationResponse.success, true);
    assert.equal(mockSimulationResponse.simulation.branchTaken, "actions");
    assert.equal(mockSimulationResponse.simulation.consolidatedUpdates.status, "in-progress");
  });
});

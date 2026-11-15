import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("PM-03: Backlog Task Reordering & Priority Ranking", () => {
  it("computes new sequential order indices for drag-and-drop prioritization", () => {
    const backlogTasks = [
      { _id: "t1", title: "Low priority fix", order: 0 },
      { _id: "t2", title: "Urgent security patch", order: 1 },
      { _id: "t3", title: "Refactor database", order: 2 },
    ];

    // Drag t2 (index 1) to top (index 0)
    const reordered = [
      backlogTasks[1],
      backlogTasks[0],
      backlogTasks[2],
    ];

    const bulkUpdatePayload = reordered.map((task, newIndex) => ({
      taskId: task._id,
      order: newIndex,
    }));

    assert.equal(bulkUpdatePayload[0].taskId, "t2");
    assert.equal(bulkUpdatePayload[0].order, 0);
    assert.equal(bulkUpdatePayload[1].taskId, "t1");
    assert.equal(bulkUpdatePayload[1].order, 1);
    assert.equal(bulkUpdatePayload[2].taskId, "t3");
    assert.equal(bulkUpdatePayload[2].order, 2);
  });
});

describe("PM-03: Bulk Task Movements & Sprint Assignment", () => {
  it("moves selected backlog tasks into a target sprint", () => {
    const tasks = [
      { _id: "t1", title: "Task 1", sprintId: null },
      { _id: "t2", title: "Task 2", sprintId: null },
      { _id: "t3", title: "Task 3", sprintId: null },
    ];

    const selectedIds = ["t1", "t3"];
    const targetSprintId = "sprint_beta_42";

    const updatedTasks = tasks.map((t) => {
      if (selectedIds.includes(t._id)) {
        return { ...t, sprintId: targetSprintId };
      }
      return t;
    });

    assert.equal(updatedTasks[0].sprintId, "sprint_beta_42");
    assert.equal(updatedTasks[1].sprintId, null);
    assert.equal(updatedTasks[2].sprintId, "sprint_beta_42");
  });

  it("removes selected tasks from sprint back to product backlog", () => {
    const tasks = [
      { _id: "t1", title: "Task 1", sprintId: "sprint_alpha" },
      { _id: "t2", title: "Task 2", sprintId: "sprint_alpha" },
    ];

    const selectedIds = ["t1", "t2"];
    const updatedTasks = tasks.map((t) => {
      if (selectedIds.includes(t._id)) {
        return { ...t, sprintId: null };
      }
      return t;
    });

    assert.equal(updatedTasks[0].sprintId, null);
    assert.equal(updatedTasks[1].sprintId, null);
  });
});

describe("PM-03: Sprint Capacity Estimation & Overload Detection", () => {
  it("calculates accurate capacity utilization and flags overload when workload exceeds capacity", () => {
    const sprint = {
      name: "Sprint 5",
      capacity: 40, // 40 hours allocated
    };

    const tasksWithinCapacity = [
      { _id: "t1", estimatedHours: 15 },
      { _id: "t2", estimatedHours: 20 },
    ];

    const totalCommitted = tasksWithinCapacity.reduce((sum, t) => sum + t.estimatedHours, 0);
    const utilization = Math.round((totalCommitted / sprint.capacity) * 100);
    const isOverloaded = totalCommitted > sprint.capacity;

    assert.equal(totalCommitted, 35);
    assert.equal(utilization, 88);
    assert.equal(isOverloaded, false);

    // Add extra task that exceeds limit
    const overloadedTasks = [...tasksWithinCapacity, { _id: "t3", estimatedHours: 10 }];
    const newCommitted = overloadedTasks.reduce((sum, t) => sum + t.estimatedHours, 0);
    const newUtilization = Math.round((newCommitted / sprint.capacity) * 100);
    const newIsOverloaded = newCommitted > sprint.capacity;

    assert.equal(newCommitted, 45);
    assert.equal(newUtilization, 113);
    assert.equal(newIsOverloaded, true);
  });

  it("handles sprints without configured capacity cleanly without errors", () => {
    const sprintWithoutCapacity = {
      name: "Sprint Unbounded",
      capacity: null,
    };

    const tasks = [{ estimatedHours: 10 }, { estimatedHours: 20 }];
    const totalCommitted = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
    const isOverloaded = sprintWithoutCapacity.capacity !== null && totalCommitted > sprintWithoutCapacity.capacity;
    const utilization = sprintWithoutCapacity.capacity ? Math.round((totalCommitted / sprintWithoutCapacity.capacity) * 100) : null;

    assert.equal(totalCommitted, 30);
    assert.equal(isOverloaded, false);
    assert.equal(utilization, null);
  });
});

describe("PM-03: Project Isolation & Anti-IDOR Boundary Checks", () => {
  it("prevents updating tasks belonging to a different project during bulk update", () => {
    const projectATasks = [{ _id: "t1", projectId: "proj_A" }];
    const projectBTasks = [{ _id: "t2", projectId: "proj_B" }];

    const attemptBulkUpdate = (targetProjectId, taskIds) => {
      // Filter must strictly match both ID and projectId
      const matchedTasks = [...projectATasks, ...projectBTasks].filter(
        (t) => taskIds.includes(t._id) && t.projectId === targetProjectId
      );
      return matchedTasks.length;
    };

    const modified = attemptBulkUpdate("proj_A", ["t1", "t2"]);
    assert.equal(modified, 1, "Only task t1 belonging to proj_A can be updated");
  });
});

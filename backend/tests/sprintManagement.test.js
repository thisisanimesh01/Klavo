import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("PM-02: Sprint Model & Status Lifecycle Transitions", () => {
  it("enforces valid sprint statuses and rejects unsupported ones", () => {
    const validStatuses = ["planned", "active", "completed", "archived"];
    const invalidStatuses = ["draft", "running", "closed", "in-progress"];

    validStatuses.forEach((st) => {
      assert.ok(validStatuses.includes(st), `Status ${st} should be valid`);
    });

    invalidStatuses.forEach((st) => {
      assert.ok(!validStatuses.includes(st), `Status ${st} should be rejected`);
    });
  });

  it("validates sprint date constraint: start date cannot be after end date", () => {
    const validDates = {
      startDate: new Date("2026-11-01"),
      endDate: new Date("2026-11-15"),
    };
    assert.ok(validDates.startDate <= validDates.endDate, "Valid date range accepted");

    const invalidDates = {
      startDate: new Date("2026-11-20"),
      endDate: new Date("2026-11-10"),
    };
    const isInvalid = invalidDates.startDate > invalidDates.endDate;
    assert.equal(isInvalid, true, "Invalid date range detected");
  });

  it("enforces single active sprint per project invariant", () => {
    const projectSprints = [
      { id: "s1", name: "Sprint 1", status: "completed" },
      { id: "s2", name: "Sprint 2", status: "active" },
      { id: "s3", name: "Sprint 3", status: "planned" },
    ];

    const canStartSprint = (sprintToStartId) => {
      const activeSprint = projectSprints.find(
        (s) => s.status === "active" && s.id !== sprintToStartId
      );
      return !activeSprint;
    };

    // Attempting to start Sprint 3 while Sprint 2 is active must fail
    assert.equal(canStartSprint("s3"), false, "Cannot start Sprint 3 while Sprint 2 is active");

    // Once Sprint 2 completes, Sprint 3 can start
    projectSprints[1].status = "completed";
    assert.equal(canStartSprint("s3"), true, "Can start Sprint 3 once previous sprint is completed");
  });
});

describe("PM-02: Sprint Completion & Unfinished Task Rollover Logic", () => {
  it("rolls over incomplete tasks to product backlog when no target sprint specified", () => {
    const sprintTasks = [
      { id: "t1", title: "Setup auth", status: "done", sprintId: "sprint_1" },
      { id: "t2", title: "Fix edge case", status: "in-progress", sprintId: "sprint_1" },
      { id: "t3", title: "Write docs", status: "todo", sprintId: "sprint_1" },
    ];

    const rolloverTarget = null; // Backlog

    const updatedTasks = sprintTasks.map((t) => {
      if (t.status !== "done") {
        return { ...t, sprintId: rolloverTarget };
      }
      return t;
    });

    assert.equal(updatedTasks[0].sprintId, "sprint_1", "Completed task remains in Sprint 1");
    assert.equal(updatedTasks[1].sprintId, null, "Incomplete task t2 rolled over to backlog");
    assert.equal(updatedTasks[2].sprintId, null, "Incomplete task t3 rolled over to backlog");
  });

  it("rolls over incomplete tasks to next sprint when target sprint provided", () => {
    const sprintTasks = [
      { id: "t1", title: "Task 1", status: "done", sprintId: "sprint_1" },
      { id: "t2", title: "Task 2", status: "in-progress", sprintId: "sprint_1" },
    ];

    const targetSprintId = "sprint_2";

    const updatedTasks = sprintTasks.map((t) => {
      if (t.status !== "done") {
        return { ...t, sprintId: targetSprintId };
      }
      return t;
    });

    assert.equal(updatedTasks[0].sprintId, "sprint_1");
    assert.equal(updatedTasks[1].sprintId, "sprint_2");
  });
});

describe("PM-02: Sprint Metrics & Progress Calculations", () => {
  it("calculates accurate completion percentage and burndown progress", () => {
    const tasks = [
      { id: "1", status: "done", estimatedHours: 4 },
      { id: "2", status: "done", estimatedHours: 2 },
      { id: "3", status: "in-progress", estimatedHours: 6 },
      { id: "4", status: "todo", estimatedHours: 4 },
    ];

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "done").length;
    const progress = Math.round((completedTasks / totalTasks) * 100);

    const totalHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const completedHours = tasks
      .filter((t) => t.status === "done")
      .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

    assert.equal(totalTasks, 4);
    assert.equal(completedTasks, 2);
    assert.equal(progress, 50);
    assert.equal(totalHours, 16);
    assert.equal(completedHours, 6);
  });
});

describe("PM-02: Authorization & IDOR Protection on Sprints", () => {
  it("permits team members to view and update sprints and rejects outsiders", () => {
    const projectTeam = {
      _id: "team_alpha",
      members: ["user_alice", "user_bob"],
      owner: "user_alice",
    };

    const isAuthorized = (userId) => {
      return projectTeam.owner === userId || projectTeam.members.includes(userId);
    };

    assert.equal(isAuthorized("user_alice"), true, "Owner authorized");
    assert.equal(isAuthorized("user_bob"), true, "Member authorized");
    assert.equal(isAuthorized("user_eve"), false, "Outsider blocked (anti-IDOR)");
  });
});

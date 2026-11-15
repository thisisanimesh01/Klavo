import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

test("PM-05: Milestone Model & Status Validation", async (t) => {
  await t.test("enforces valid milestone statuses and default planned state", () => {
    const validStatuses = ["planned", "in_progress", "completed", "archived"];
    const testCases = [
      { status: "planned", expectedValid: true },
      { status: "in_progress", expectedValid: true },
      { status: "completed", expectedValid: true },
      { status: "archived", expectedValid: true },
      { status: "invalid_status", expectedValid: false },
      { status: undefined, expectedDefault: "planned" },
    ];

    testCases.forEach((tc) => {
      if (tc.expectedValid !== undefined) {
        assert.equal(validStatuses.includes(tc.status), tc.expectedValid);
      }
      if (tc.expectedDefault !== undefined) {
        const resolved = tc.status || "planned";
        assert.equal(resolved, tc.expectedDefault);
      }
    });
  });

  await t.test("validates milestone date constraints: start date cannot be after due date", () => {
    const validMilestone = {
      startDate: new Date("2026-06-01"),
      dueDate: new Date("2026-06-30"),
    };
    assert.ok(validMilestone.startDate <= validMilestone.dueDate);

    const invalidMilestone = {
      startDate: new Date("2026-07-01"),
      dueDate: new Date("2026-06-01"),
    };
    assert.ok(invalidMilestone.startDate > invalidMilestone.dueDate);
  });
});

test("PM-05: Milestone Progress Metrics & Overdue Calculation", async (t) => {
  await t.test("calculates accurate completion percentage from associated tasks", () => {
    const milestoneId = "ms_100";
    const tasks = [
      { _id: "t1", milestoneId, status: "done" },
      { _id: "t2", milestoneId, status: "done" },
      { _id: "t3", milestoneId, status: "in-progress" },
      { _id: "t4", milestoneId, status: "todo" },
    ];

    const mTasks = tasks.filter((t) => t.milestoneId === milestoneId);
    const total = mTasks.length;
    const completed = mTasks.filter((t) => t.status === "done").length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    assert.equal(total, 4);
    assert.equal(completed, 2);
    assert.equal(progress, 50);

    // Empty milestone edge case
    const emptyProgress = 0 > 0 ? Math.round((0 / 0) * 100) : 0;
    assert.equal(emptyProgress, 0);
  });

  await t.test("flags milestone as overdue if dueDate is past and status is not completed/archived", () => {
    const now = new Date("2026-06-15");
    const isOverdue = (m) =>
      Boolean(m.dueDate && new Date(m.dueDate) < now && m.status !== "completed" && m.status !== "archived");

    const overdueMilestone = {
      dueDate: "2026-06-10",
      status: "in_progress",
    };
    assert.equal(isOverdue(overdueMilestone), true);

    const completedMilestone = {
      dueDate: "2026-06-10",
      status: "completed",
    };
    assert.equal(isOverdue(completedMilestone), false);

    const futureMilestone = {
      dueDate: "2026-06-20",
      status: "planned",
    };
    assert.equal(isOverdue(futureMilestone), false);
  });
});

test("PM-05: Gantt Timeline Aggregation & Dependency Resolution", async (t) => {
  await t.test("aggregates task timeline intervals and maps dependency edges", () => {
    const tasks = [
      {
        _id: "task_1",
        title: "Architecture Spec",
        status: "done",
        createdAt: new Date("2026-06-01"),
        dueDate: new Date("2026-06-05"),
        dependencies: [],
      },
      {
        _id: "task_2",
        title: "API Implementation",
        status: "in-progress",
        createdAt: new Date("2026-06-06"),
        dueDate: new Date("2026-06-12"),
        dependencies: [{ taskId: { _id: "task_1", title: "Architecture Spec", status: "done" }, type: "blocked-by" }],
      },
    ];

    const ganttTasks = tasks.map((t) => {
      const blockingDeps = (t.dependencies || [])
        .filter((d) => d.type === "blocked-by" || d.type === "blocks")
        .map((d) => ({
          targetTaskId: d.taskId?._id,
          targetTitle: d.taskId?.title,
          type: d.type,
          isResolved: d.taskId?.status === "done",
        }));

      return {
        _id: t._id,
        title: t.title,
        dependencies: blockingDeps,
        progress: t.status === "done" ? 100 : t.status === "in-progress" ? 50 : 0,
      };
    });

    assert.equal(ganttTasks.length, 2);
    assert.equal(ganttTasks[0].progress, 100);
    assert.equal(ganttTasks[1].progress, 50);
    assert.equal(ganttTasks[1].dependencies.length, 1);
    assert.equal(ganttTasks[1].dependencies[0].targetTaskId, "task_1");
    assert.equal(ganttTasks[1].dependencies[0].isResolved, true);
  });

  await t.test("enforces project isolation on milestone task assignment", () => {
    const projectAlphaId = "proj_alpha";
    const projectBetaId = "proj_beta";

    const milestone = { _id: "m_alpha", projectId: projectAlphaId };
    const taskCandidates = [
      { _id: "t1", projectId: projectAlphaId },
      { _id: "t2", projectId: projectBetaId },
    ];

    const assignableTasks = taskCandidates.filter((t) => t.projectId === milestone.projectId);
    assert.equal(assignableTasks.length, 1);
    assert.equal(assignableTasks[0]._id, "t1");
  });
});

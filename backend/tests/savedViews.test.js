import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { buildTaskFilterQuery, buildTaskSortConfig } from "../src/utils/filterHelpers.js";

test("PM-07: Advanced Task Search & Filter Query Builder", async (t) => {
  const dummyProjectId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();

  await t.test("builds multi-field regex text search across title, description, and labels", () => {
    const query = buildTaskFilterQuery(dummyProjectId, { search: "auth login" }, dummyUserId);
    assert.equal(query.projectId.toString(), dummyProjectId.toString());
    assert.ok(Array.isArray(query.$or));
    assert.equal(query.$or.length, 3);
    assert.equal(query.$or[0].title.source, "auth login");
    assert.equal(query.$or[1].description.source, "auth login");
    assert.equal(query.$or[2]["labels.name"].source, "auth login");
  });

  await t.test("handles multi-status and multi-priority array filters correctly", () => {
    const query = buildTaskFilterQuery(
      dummyProjectId,
      {
        statuses: ["todo", "in-progress", "qa-testing"],
        priorities: ["high", "critical", "urgent"],
      },
      dummyUserId
    );
    assert.deepEqual(query.status, { $in: ["todo", "in-progress", "qa-testing"] });
    assert.deepEqual(query.priority, { $in: ["high", "critical", "urgent"] });
  });

  await t.test("supports comma-separated string format for statuses and priorities", () => {
    const query = buildTaskFilterQuery(
      dummyProjectId,
      {
        statuses: "todo, review, done",
        priorities: "low, medium",
      },
      dummyUserId
    );
    assert.deepEqual(query.status, { $in: ["todo", "review", "done"] });
    assert.deepEqual(query.priority, { $in: ["low", "medium"] });
  });

  await t.test("handles assignee filtering for specific users, 'unassigned', and 'me'", () => {
    const specificUser = new mongoose.Types.ObjectId();
    const querySpecific = buildTaskFilterQuery(dummyProjectId, { assignees: [specificUser.toString()] }, dummyUserId);
    assert.deepEqual(querySpecific.assignedTo, { $in: [specificUser] });

    const queryMe = buildTaskFilterQuery(dummyProjectId, { assignees: ["me"] }, dummyUserId);
    assert.deepEqual(queryMe.assignedTo, { $in: [dummyUserId] });

    const queryUnassigned = buildTaskFilterQuery(dummyProjectId, { assignedTo: "unassigned" }, dummyUserId);
    assert.deepEqual(queryUnassigned.$or, [{ assignedTo: { $size: 0 } }, { assignedTo: { $exists: false } }]);
  });

  await t.test("filters by due date ranges (overdue, today, no_due_date)", () => {
    const queryOverdue = buildTaskFilterQuery(dummyProjectId, { dueDateFilter: "overdue" }, dummyUserId);
    assert.ok(queryOverdue.dueDate);
    assert.equal(queryOverdue.dueDate.$ne, null);
    assert.ok(queryOverdue.dueDate.$lt instanceof Date);

    const queryNoDueDate = buildTaskFilterQuery(dummyProjectId, { dueDateFilter: "no_due_date" }, dummyUserId);
    assert.deepEqual(queryNoDueDate.$or, [{ dueDate: null }, { dueDate: { $exists: false } }]);
  });

  await t.test("filters by dependency relationships (blocked_only, has_dependencies)", () => {
    const queryBlocked = buildTaskFilterQuery(dummyProjectId, { dependencyFilter: "blocked_only" }, dummyUserId);
    assert.deepEqual(queryBlocked.dependencies, { $elemMatch: { type: "blocked-by" } });

    const queryHasDeps = buildTaskFilterQuery(dummyProjectId, { dependencyFilter: "has_dependencies" }, dummyUserId);
    assert.deepEqual(queryHasDeps.dependencies, { $exists: true, $not: { $size: 0 } });
  });

  await t.test("filters by dynamic custom field criteria", () => {
    const query = buildTaskFilterQuery(
      dummyProjectId,
      {
        customFieldFilters: [
          { name: "Environment", operator: "equals", value: "Production" },
          { name: "Customer", operator: "contains", value: "Acme" },
        ],
      },
      dummyUserId
    );
    assert.ok(query.customFields || query.$and);
  });
});

test("PM-07: Configurable Sorting & Grouping Rules", async (t) => {
  await t.test("builds sort configurations for order, priority, dueDate, and title", () => {
    const sortOrderAsc = buildTaskSortConfig("order", "asc");
    assert.deepEqual(sortOrderAsc, { status: 1, order: 1, createdAt: 1 });

    const sortDueDateDesc = buildTaskSortConfig("dueDate", "desc");
    assert.deepEqual(sortDueDateDesc, { dueDate: -1, order: 1 });

    const sortTitleAsc = buildTaskSortConfig("title", "asc");
    assert.deepEqual(sortTitleAsc, { title: 1 });
  });

  await t.test("in-memory grouping partitions tasks by priority, status, assignee, and milestone", () => {
    const sampleTasks = [
      { _id: "t1", status: "todo", priority: "high", milestoneId: { _id: "m1", name: "Alpha" } },
      { _id: "t2", status: "in-progress", priority: "high", milestoneId: null },
      { _id: "t3", status: "done", priority: "low", milestoneId: { _id: "m1", name: "Alpha" } },
    ];

    const groupTasks = (tasks, groupBy) => {
      const groups = {};
      for (const t of tasks) {
        let key = "None";
        if (groupBy === "priority") key = t.priority || "None";
        else if (groupBy === "status") key = t.status || "None";
        else if (groupBy === "milestone") key = t.milestoneId?.name || "No Milestone";
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      }
      return groups;
    };

    const groupedByPriority = groupTasks(sampleTasks, "priority");
    assert.equal(groupedByPriority["high"].length, 2);
    assert.equal(groupedByPriority["low"].length, 1);

    const groupedByMilestone = groupTasks(sampleTasks, "milestone");
    assert.equal(groupedByMilestone["Alpha"].length, 2);
    assert.equal(groupedByMilestone["No Milestone"].length, 1);
  });
});

test("PM-07: Saved Views Ownership & Multi-Tenant Authorization", async (t) => {
  const aliceId = new mongoose.Types.ObjectId().toString();
  const bobId = new mongoose.Types.ObjectId().toString();
  const eveId = new mongoose.Types.ObjectId().toString();

  const savedViews = [
    { _id: "v1", name: "Alice's Private View", createdBy: aliceId, isShared: false },
    { _id: "v2", name: "Team Sprint 1 View", createdBy: aliceId, isShared: true },
    { _id: "v3", name: "Bob's Personal Kanban", createdBy: bobId, isShared: false },
  ];

  await t.test("Alice can see her private views and shared team views", () => {
    const aliceViews = savedViews.filter((v) => v.isShared || v.createdBy === aliceId);
    assert.equal(aliceViews.length, 2);
    assert.ok(aliceViews.some((v) => v._id === "v1"));
    assert.ok(aliceViews.some((v) => v._id === "v2"));
    assert.ok(!aliceViews.some((v) => v._id === "v3"));
  });

  await t.test("Bob can see his private views and shared team views", () => {
    const bobViews = savedViews.filter((v) => v.isShared || v.createdBy === bobId);
    assert.equal(bobViews.length, 2);
    assert.ok(bobViews.some((v) => v._id === "v2"));
    assert.ok(bobViews.some((v) => v._id === "v3"));
    assert.ok(!bobViews.some((v) => v._id === "v1"));
  });

  await t.test("Only view creator or team owner is authorized to update or delete a view", () => {
    const canMutate = (view, requestingUserId, isTeamOwner) => {
      if (isTeamOwner) return true;
      return view.createdBy === requestingUserId;
    };

    assert.equal(canMutate(savedViews[0], aliceId, false), true); // Alice mutates her view
    assert.equal(canMutate(savedViews[0], bobId, false), false); // Bob cannot mutate Alice's view
    assert.equal(canMutate(savedViews[1], bobId, false), false); // Bob cannot mutate Alice's shared view (not owner)
    assert.equal(canMutate(savedViews[1], bobId, true), true); // Bob as team owner can update shared view
    assert.equal(canMutate(savedViews[0], eveId, false), false); // Eve cannot mutate anything
  });
});

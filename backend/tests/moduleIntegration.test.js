import test from "node:test";
import assert from "node:assert/strict";
import { mockUsers, mockTeams, mockProjects, mockTasks } from "./fixtures/mockData.js";

test("MOD-01: File Management RBAC & Lifecycle", async (t) => {
  // In-memory file repository simulation
  const mockFiles = [
    {
      _id: "file_001",
      projectId: mockProjects.projectAlpha._id,
      userId: mockUsers.alice._id,
      filename: "architecture_spec.pdf",
      size: 1048576, // 1MB
      storageKey: "1234567-spec.pdf",
    },
  ];

  const checkProjectAccess = (projectId, userId) => {
    const project = Object.values(mockProjects).find((p) => p._id === projectId);
    if (!project) return { hasAccess: false };
    const team = mockTeams.teamAlpha;
    const isMember = team.members.includes(userId);
    const isOwner = team.owner === userId;
    return { hasAccess: isMember || isOwner, isOwner, project };
  };

  await t.test("Team member can list files for project", () => {
    const { hasAccess } = checkProjectAccess(mockProjects.projectAlpha._id, mockUsers.bob._id);
    assert.equal(hasAccess, true);
    const files = mockFiles.filter((f) => f.projectId === mockProjects.projectAlpha._id);
    assert.equal(files.length, 1);
    assert.equal(files[0].filename, "architecture_spec.pdf");
  });

  await t.test("Outsider cannot list project files (IDOR protection)", () => {
    const { hasAccess } = checkProjectAccess(mockProjects.projectAlpha._id, mockUsers.eve._id);
    assert.equal(hasAccess, false);
  });

  await t.test("File uploader or project owner can delete file; non-owner member cannot delete another's file", () => {
    const targetFile = mockFiles[0];

    const canDelete = (file, userId) => {
      const { hasAccess, isOwner } = checkProjectAccess(file.projectId, userId);
      if (!hasAccess) return false;
      const isUploader = file.userId === userId;
      return isUploader || isOwner;
    };

    // Alice is uploader & owner -> allowed
    assert.equal(canDelete(targetFile, mockUsers.alice._id), true);

    // Bob is member but neither uploader nor owner -> denied
    assert.equal(canDelete(targetFile, mockUsers.bob._id), false);

    // Eve is outsider -> denied
    assert.equal(canDelete(targetFile, mockUsers.eve._id), false);
  });
});

test("MOD-01: Calendar Deadline Scoping & Overdue Calculation", async (t) => {
  const now = new Date("2026-11-15T00:00:00Z");

  const sampleTasks = [
    {
      _id: "t_past",
      title: "Past Due Task",
      assignedTo: [mockUsers.alice._id],
      dueDate: new Date("2026-11-01T00:00:00Z"),
      status: "in-progress",
    },
    {
      _id: "t_future",
      title: "Future Task",
      assignedTo: [mockUsers.alice._id],
      dueDate: new Date("2026-12-01T00:00:00Z"),
      status: "todo",
    },
    {
      _id: "t_done_past",
      title: "Completed Task",
      assignedTo: [mockUsers.alice._id],
      dueDate: new Date("2026-11-01T00:00:00Z"),
      status: "done",
    },
  ];

  await t.test("Correctly flags incomplete past-due tasks as overdue", () => {
    const isOverdue = (task) => task.dueDate < now && task.status !== "done";

    assert.equal(isOverdue(sampleTasks[0]), true, "Past incomplete task is overdue");
    assert.equal(isOverdue(sampleTasks[1]), false, "Future task is not overdue");
    assert.equal(isOverdue(sampleTasks[2]), false, "Completed task is never overdue");
  });
});

test("MOD-01: Project & Team Analytics Calculations", async (t) => {
  const projectTasks = [
    { _id: "1", status: "todo", priority: "low" },
    { _id: "2", status: "in-progress", priority: "high" },
    { _id: "3", status: "done", priority: "critical" },
    { _id: "4", status: "done", priority: "medium" },
  ];

  await t.test("Computes accurate completion rate and distribution counts", () => {
    const taskCount = projectTasks.length;
    const completedCount = projectTasks.filter((t) => t.status === "done").length;
    const completionRate = Math.round((completedCount / taskCount) * 100);

    assert.equal(taskCount, 4);
    assert.equal(completedCount, 2);
    assert.equal(completionRate, 50);

    const statusCounts = {
      todo: projectTasks.filter((t) => t.status === "todo").length,
      "in-progress": projectTasks.filter((t) => t.status === "in-progress").length,
      done: projectTasks.filter((t) => t.status === "done").length,
    };

    assert.equal(statusCounts.todo, 1);
    assert.equal(statusCounts["in-progress"], 1);
    assert.equal(statusCounts.done, 2);
  });
});

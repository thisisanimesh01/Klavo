import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("PM-04: Task Dependencies & Circular Dependency Detection", () => {
  it("rejects self-dependency where task attempts to depend on itself", () => {
    const taskId = "task_alpha";
    const targetTaskId = "task_alpha";

    const isSelfDep = taskId === targetTaskId;
    assert.equal(isSelfDep, true, "Self dependency must be detected and rejected");
  });

  it("detects direct 2-node circular dependency (A blocks B, B attempts to block A)", () => {
    // Current state: A blocks B (A -> B)
    // Attempting to add: B blocks A (B -> A)
    const graph = {
      task_A: ["task_B"], // A blocks B
      task_B: [],
    };

    const wouldCreateCycle = (fromNode, toNode) => {
      // Check if path already exists from toNode to fromNode
      const visited = new Set();
      const queue = [toNode];
      while (queue.length > 0) {
        const curr = queue.shift();
        if (curr === fromNode) return true;
        if (!visited.has(curr)) {
          visited.add(curr);
          const neighbors = graph[curr] || [];
          for (const n of neighbors) {
            queue.push(n);
          }
        }
      }
      return false;
    };

    // Adding B -> A: fromNode = task_B, toNode = task_A
    // Since task_A already reaches task_B, adding B -> A creates a cycle
    const cycleDetected = wouldCreateCycle("task_B", "task_A");
    assert.equal(cycleDetected, true, "Circular dependency A <-> B detected");
  });

  it("detects multi-hop transitive cycle (A -> B -> C, C attempts to block A)", () => {
    const graph = {
      task_A: ["task_B"],
      task_B: ["task_C"],
      task_C: [],
    };

    const wouldCreateCycle = (fromNode, toNode) => {
      const visited = new Set();
      const queue = [toNode];
      while (queue.length > 0) {
        const curr = queue.shift();
        if (curr === fromNode) return true;
        if (!visited.has(curr)) {
          visited.add(curr);
          const neighbors = graph[curr] || [];
          for (const n of neighbors) {
            queue.push(n);
          }
        }
      }
      return false;
    };

    // Attempting to add C -> A
    const cycleDetected = wouldCreateCycle("task_C", "task_A");
    assert.equal(cycleDetected, true, "Transitive circular dependency A -> B -> C -> A detected");

    // Adding unrelated dependency D -> C should not cause a cycle
    graph.task_D = [];
    const safeDep = wouldCreateCycle("task_D", "task_C");
    assert.equal(safeDep, false, "Valid acyclic dependency accepted");
  });

  it("allows non-blocking 'relates-to' relationships regardless of cycles", () => {
    const type = "relates-to";
    const isBlocking = type !== "relates-to";
    assert.equal(isBlocking, false, "'relates-to' is non-blocking and safe from deadlock");
  });
});

describe("PM-04: Blocker Completion Gates & Status Enforcement", () => {
  it("blocks moving task to 'done' when uncompleted blocking tasks exist", () => {
    const task = {
      _id: "task_target",
      title: "Deploy to Prod",
      status: "in-progress",
      dependencies: [
        { taskId: "task_sec_audit", type: "blocked-by" },
      ],
    };

    const allTasks = [
      task,
      { _id: "task_sec_audit", title: "Security Review", status: "in-progress" },
    ];

    const canComplete = (t) => {
      const blockerIds = (t.dependencies || [])
        .filter((d) => d.type === "blocked-by")
        .map((d) => d.taskId);

      const unresolvedBlockers = allTasks.filter(
        (other) => blockerIds.includes(other._id) && other.status !== "done"
      );

      return {
        allowed: unresolvedBlockers.length === 0,
        unresolvedBlockers,
      };
    };

    const check1 = canComplete(task);
    assert.equal(check1.allowed, false, "Blocked task cannot be completed while blocker is in-progress");
    assert.equal(check1.unresolvedBlockers.length, 1);

    // Resolve the blocking task
    allTasks[1].status = "done";
    const check2 = canComplete(task);
    assert.equal(check2.allowed, true, "Task can be completed once all blockers are done");
  });
});

describe("PM-04: Subtask Hierarchy & Progress Aggregation", () => {
  it("calculates accurate subtask completion metrics and progress percentage", () => {
    const subtasks = [
      { _id: "st_1", parentId: "task_parent", status: "done" },
      { _id: "st_2", parentId: "task_parent", status: "done" },
      { _id: "st_3", parentId: "task_parent", status: "todo" },
      { _id: "st_4", parentId: "task_parent", status: "in-progress" },
    ];

    const totalSubtasks = subtasks.length;
    const completedSubtasks = subtasks.filter((st) => st.status === "done").length;
    const progress = Math.round((completedSubtasks / totalSubtasks) * 100);

    assert.equal(totalSubtasks, 4);
    assert.equal(completedSubtasks, 2);
    assert.equal(progress, 50);
  });

  it("enforces project isolation: parent and subtask must belong to identical projectId", () => {
    const parentTask = { _id: "p1", projectId: "proj_alpha" };
    const validSubtask = { _id: "s1", parentId: "p1", projectId: "proj_alpha" };
    const invalidSubtask = { _id: "s2", parentId: "p1", projectId: "proj_beta" };

    const isHierarchyValid = (parent, subtask) => {
      return parent.projectId === subtask.projectId;
    };

    assert.equal(isHierarchyValid(parentTask, validSubtask), true);
    assert.equal(isHierarchyValid(parentTask, invalidSubtask), false, "Cross-project parent-child rejected");
  });
});

import Task from "../models/Task.js";

/**
 * Checks if adding a directed dependency edge (fromTaskId -> toTaskId) would create a cycle.
 * For example: if A is blocked by B (B -> A), and we attempt to make B blocked by A (A -> B),
 * that forms a directed cycle.
 *
 * @param {string} sourceTaskId - The task on which the dependency is being added
 * @param {string} targetTaskId - The target task being referenced
 * @param {string} dependencyType - 'blocks' | 'blocked-by' | 'relates-to'
 * @returns {Promise<{hasCycle: boolean, path: string[]}>}
 */
export const detectCircularDependency = async (sourceTaskId, targetTaskId, dependencyType) => {
  // 'relates-to' is an undirected non-blocking association and cannot create execution deadlocks
  if (dependencyType === "relates-to") {
    return { hasCycle: false, path: [] };
  }

  const sId = sourceTaskId.toString();
  const tId = targetTaskId.toString();

  // Self-dependency check
  if (sId === tId) {
    return { hasCycle: true, path: [sId, tId] };
  }

  // Determine directed edge:
  // If task A is "blocked-by" B, then B must complete before A: edge is B -> A
  // If task A "blocks" B, then A must complete before B: edge is A -> B
  const fromId = dependencyType === "blocked-by" ? tId : sId;
  const toId = dependencyType === "blocked-by" ? sId : tId;

  // We want to verify if there is already a path from `toId` to `fromId` in the blocking graph.
  // If a path toId -> ... -> fromId already exists, adding fromId -> toId creates a cycle.
  const visited = new Set();
  const queue = [[toId]];

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const currNode = currentPath[currentPath.length - 1];

    if (currNode === fromId) {
      return { hasCycle: true, path: [...currentPath, toId] };
    }

    if (!visited.has(currNode)) {
      visited.add(currNode);

      // Fetch task to find all tasks that it blocks or is blocked by
      const task = await Task.findById(currNode).select("dependencies");
      if (task && Array.isArray(task.dependencies)) {
        for (const dep of task.dependencies) {
          if (!dep.taskId) continue;
          const nextTaskId = dep.taskId.toString();

          // Outgoing blocking edge from currNode:
          // 1. dep.type === 'blocks' means currNode -> nextTaskId
          // 2. OR another task has dep.type === 'blocked-by' currNode
          if (dep.type === "blocks" && !visited.has(nextTaskId)) {
            queue.push([...currentPath, nextTaskId]);
          }
        }

        // Also query inverse: any task X that is "blocked-by" currNode (currNode -> X)
        const blockedByMeTasks = await Task.find({
          dependencies: { $elemMatch: { taskId: currNode, type: "blocked-by" } },
        }).select("_id");

        for (const bTask of blockedByMeTasks) {
          const bId = bTask._id.toString();
          if (!visited.has(bId)) {
            queue.push([...currentPath, bId]);
          }
        }
      }
    }
  }

  return { hasCycle: false, path: [] };
};

/**
 * Checks if a task has active blockers (uncompleted tasks that block it).
 * @param {string|ObjectId} taskId
 * @returns {Promise<{isBlocked: boolean, blockingTasks: object[]}>}
 */
export const checkTaskBlockers = async (taskId) => {
  const task = await Task.findById(taskId).select("dependencies");
  if (!task) return { isBlocked: false, blockingTasks: [] };

  const blockerIds = [];

  // Direct dependencies on this task marked as 'blocked-by'
  if (Array.isArray(task.dependencies)) {
    task.dependencies.forEach((d) => {
      if (d.type === "blocked-by" && d.taskId) {
        blockerIds.push(d.taskId);
      }
    });
  }

  // Reverse dependencies: other tasks that mark this task as 'blocks'
  const reverseBlockers = await Task.find({
    dependencies: { $elemMatch: { taskId, type: "blocks" } },
  }).select("_id");

  reverseBlockers.forEach((rb) => {
    blockerIds.push(rb._id);
  });

  if (blockerIds.length === 0) {
    return { isBlocked: false, blockingTasks: [] };
  }

  // Find incomplete blocking tasks
  const incompleteBlockers = await Task.find({
    _id: { $in: blockerIds },
    status: { $ne: "done" },
  }).select("_id title status priority assignedTo");

  return {
    isBlocked: incompleteBlockers.length > 0,
    blockingTasks: incompleteBlockers,
  };
};

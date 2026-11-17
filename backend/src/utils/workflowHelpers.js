import Workflow from "../models/Workflow.js";

export const DEFAULT_STATUSES = [
  { key: "todo", name: "Todo", color: "#94a3b8", category: "todo", order: 0 },
  { key: "in-progress", name: "In Progress", color: "#3b82f6", category: "in_progress", order: 1 },
  { key: "review", name: "In Review", color: "#f59e0b", category: "review", order: 2 },
  { key: "done", name: "Done", color: "#10b981", category: "done", order: 3 },
];

/**
 * Returns the workflow for a project, creating a default one if none exists.
 */
export const getOrCreateProjectWorkflow = async (projectId, teamId, userId) => {
  let workflow = await Workflow.findOne({ projectId });
  if (!workflow && teamId && userId) {
    workflow = await Workflow.create({
      name: "Default Workflow",
      description: "Standard project lifecycle workflow",
      projectId,
      teamId,
      statuses: DEFAULT_STATUSES,
      isDefault: true,
      createdBy: userId,
    });
  }
  return workflow;
};

/**
 * Resolves whether a given statusKey belongs to the "done" category in the project workflow.
 */
export const isStatusCompleted = (statusKey, workflow) => {
  if (!statusKey) return false;
  if (!workflow || !Array.isArray(workflow.statuses)) {
    return statusKey === "done";
  }
  const st = workflow.statuses.find((s) => s.key === statusKey);
  if (!st) {
    return statusKey === "done";
  }
  return st.category === "done";
};

/**
 * Resolves the lifecycle category ('todo', 'in_progress', 'review', 'done') of a statusKey.
 */
export const getStatusCategory = (statusKey, workflow) => {
  if (!statusKey) return "todo";
  if (!workflow || !Array.isArray(workflow.statuses)) {
    if (statusKey === "done") return "done";
    if (statusKey === "in-progress") return "in_progress";
    if (statusKey === "review") return "review";
    return "todo";
  }
  const st = workflow.statuses.find((s) => s.key === statusKey);
  return st ? st.category : (statusKey === "done" ? "done" : "todo");
};

/**
 * Returns a Set or Array of all status keys that belong to the "done" category for a project.
 */
export const getCompletedStatusKeys = (workflow) => {
  if (!workflow || !Array.isArray(workflow.statuses)) {
    return ["done"];
  }
  const keys = workflow.statuses
    .filter((s) => s.category === "done")
    .map((s) => s.key);
  return keys.length > 0 ? keys : ["done"];
};

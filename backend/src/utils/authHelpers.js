import { Team } from "../models/Team.js";
import { Project } from "../models/Project.js";
import Task from "../models/Task.js";

/**
 * Checks if a user is a member or owner of a team.
 * @param {string|ObjectId} teamId
 * @param {string|ObjectId} userId
 * @returns {Promise<{isMember: boolean, isOwner: boolean, team: object|null}>}
 */
export const checkTeamAccess = async (teamId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) return { isMember: false, isOwner: false, team: null };

  const userIdStr = userId.toString();
  const isOwner = team.owner.toString() === userIdStr;
  const isMember = isOwner || team.members.some((m) => m.toString() === userIdStr);

  return { isMember, isOwner, team };
};

/**
 * Checks if a user has access to a project through team membership.
 * @param {string|ObjectId} projectId
 * @param {string|ObjectId} userId
 * @returns {Promise<{hasAccess: boolean, isOwner: boolean, project: object|null, team: object|null}>}
 */
export const checkProjectAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return { hasAccess: false, isOwner: false, project: null, team: null };

  const { isMember, isOwner, team } = await checkTeamAccess(project.teamId, userId);
  return { hasAccess: isMember, isOwner, project, team };
};

/**
 * Checks if a user has access to a task via its project and team.
 * @param {string|ObjectId} taskId
 * @param {string|ObjectId} userId
 * @returns {Promise<{hasAccess: boolean, task: object|null, project: object|null, team: object|null}>}
 */
export const checkTaskAccess = async (taskId, userId) => {
  const task = await Task.findById(taskId);
  if (!task) return { hasAccess: false, task: null, project: null, team: null };

  const { hasAccess, project, team } = await checkProjectAccess(task.projectId, userId);
  return { hasAccess, task, project, team };
};

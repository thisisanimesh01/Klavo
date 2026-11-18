import { Team } from "../models/Team.js";
import { Project } from "../models/Project.js";
import Task from "../models/Task.js";

/**
 * Workspace role constants and hierarchy levels
 */
export const WORKSPACE_ROLES = ["owner", "admin", "member", "guest"];

export const WORKSPACE_ROLE_LEVELS = {
  owner: 4,
  admin: 3,
  member: 2,
  guest: 1,
  none: 0,
};

/**
 * Resolves the effective workspace role for a user within a team/workspace.
 *
 * Rules:
 * 1. Team Owner (`team.owner`) -> "owner"
 * 2. Explicit role in `team.memberRoles` -> assigned role ("admin", "member", "guest")
 * 3. Legacy member in `team.members` -> defaults to "member"
 * 4. Not in team -> "none"
 *
 * @param {object} team
 * @param {string|ObjectId} userId
 * @returns {"owner"|"admin"|"member"|"guest"|"none"}
 */
export const resolveWorkspaceRole = (team, userId) => {
  if (!team || !userId) return "none";

  const userIdStr = userId.toString();
  if (team.owner?.toString() === userIdStr) {
    return "owner";
  }

  // Check explicit memberRoles
  if (Array.isArray(team.memberRoles)) {
    const roleEntry = team.memberRoles.find(
      (mr) => (mr.userId?._id?.toString() || mr.userId?.toString()) === userIdStr
    );
    if (roleEntry && WORKSPACE_ROLES.includes(roleEntry.role)) {
      return roleEntry.role;
    }
  }

  // Check legacy members array fallback
  if (Array.isArray(team.members)) {
    const isLegacyMember = team.members.some(
      (m) => (m?._id?.toString() || m?.toString()) === userIdStr
    );
    if (isLegacyMember) {
      return "member";
    }
  }

  return "none";
};

/**
 * Checks if a user is a member, admin, or owner of a team, and resolves their role and capabilities.
 * @param {string|ObjectId} teamId
 * @param {string|ObjectId} userId
 * @returns {Promise<{
 *   isMember: boolean,
 *   isOwner: boolean,
 *   isAdmin: boolean,
 *   isGuest: boolean,
 *   role: "owner"|"admin"|"member"|"guest"|"none",
 *   canManageMembers: boolean,
 *   canManageSettings: boolean,
 *   canTransferOwnership: boolean,
 *   canDeleteWorkspace: boolean,
 *   team: object|null
 * }>}
 */
export const checkTeamAccess = async (teamId, userId) => {
  const team = await Team.findById(teamId);
  if (!team || !userId) {
    return {
      isMember: false,
      isOwner: false,
      isAdmin: false,
      isGuest: false,
      role: "none",
      canManageMembers: false,
      canManageSettings: false,
      canTransferOwnership: false,
      canDeleteWorkspace: false,
      team: null,
    };
  }

  const role = resolveWorkspaceRole(team, userId);
  const isOwner = role === "owner";
  const isAdmin = role === "admin" || isOwner;
  const isMember = role !== "none";
  const isGuest = role === "guest";

  return {
    isMember,
    isOwner,
    isAdmin,
    isGuest,
    role,
    canManageMembers: isAdmin,
    canManageSettings: isAdmin,
    canTransferOwnership: isOwner,
    canDeleteWorkspace: isOwner,
    team,
  };
};

/**
 * Checks if a user has access to a project through team membership and role.
 * Guests can access public team projects or projects where they are assigned tasks or explicit documents,
 * but do not have administrative or creation powers.
 *
 * @param {string|ObjectId} projectId
 * @param {string|ObjectId} userId
 * @returns {Promise<{
 *   hasAccess: boolean,
 *   isOwner: boolean,
 *   isAdmin: boolean,
 *   isGuest: boolean,
 *   role: string,
 *   project: object|null,
 *   team: object|null
 * }>}
 */
export const checkProjectAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    return {
      hasAccess: false,
      isOwner: false,
      isAdmin: false,
      isGuest: false,
      role: "none",
      project: null,
      team: null,
    };
  }

  const { isMember, isOwner, isAdmin, isGuest, role, team } = await checkTeamAccess(
    project.teamId,
    userId
  );

  return {
    hasAccess: isMember,
    isOwner,
    isAdmin,
    isGuest,
    role,
    project,
    team,
  };
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

/**
 * Checks if a user has access to a sprint via its project and team.
 * @param {string|ObjectId} sprintId
 * @param {string|ObjectId} userId
 * @returns {Promise<{hasAccess: boolean, isOwner: boolean, sprint: object|null, project: object|null, team: object|null}>}
 */
export const checkSprintAccess = async (sprintId, userId) => {
  const { default: Sprint } = await import("../models/Sprint.js");
  const sprint = await Sprint.findById(sprintId);
  if (!sprint) return { hasAccess: false, isOwner: false, sprint: null, project: null, team: null };

  const { hasAccess, isOwner, project, team } = await checkProjectAccess(sprint.projectId, userId);
  return { hasAccess, isOwner, sprint, project, team };
};

/**
 * Checks if a user has access to a milestone via its project and team.
 * @param {string|ObjectId} milestoneId
 * @param {string|ObjectId} userId
 * @returns {Promise<{hasAccess: boolean, isOwner: boolean, milestone: object|null, project: object|null, team: object|null}>}
 */
export const checkMilestoneAccess = async (milestoneId, userId) => {
  const { default: Milestone } = await import("../models/Milestone.js");
  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) return { hasAccess: false, isOwner: false, milestone: null, project: null, team: null };

  const { hasAccess, isOwner, project, team } = await checkProjectAccess(milestone.projectId, userId);
  return { hasAccess, isOwner, milestone, project, team };
};

/**
 * Retrieves all projects within a team/workspace that the user is authorized to access.
 * If user is not a member of the team, returns an empty array.
 * @param {string|ObjectId} teamId
 * @param {string|ObjectId} userId
 * @returns {Promise<Array<object>>}
 */
export const getUserAuthorizedProjectsForTeam = async (teamId, userId) => {
  const { isMember } = await checkTeamAccess(teamId, userId);
  if (!isMember) return [];

  const projects = await Project.find({ teamId }).sort({ name: 1 });
  return projects;
};

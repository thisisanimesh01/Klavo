import { User } from "../models/User.js";
import { Team } from "../models/Team.js";
import { Project } from "../models/Project.js";

/**
 * Extracts username mentions from text (@username, @user.name, etc.)
 *
 * @param {string} text
 * @returns {string[]} Array of matched usernames (without @, lowercased, deduplicated)
 */
export const extractMentionsFromText = (text) => {
  if (!text || typeof text !== "string") return [];
  const matches = text.match(/@([a-zA-Z0-9_.\s]+?)(?=\s|$|[.,!?;:])/g);
  if (!matches) return [];

  // Clean matches: strip @, trim
  const usernames = matches
    .map((m) => m.slice(1).trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(usernames));
};

/**
 * Resolves mentioned users within a project team, ensuring no cross-team leakage.
 *
 * @param {string} text
 * @param {string|ObjectId} projectId
 * @returns {Promise<Array<object>>} Matched User documents
 */
export const resolveEligibleMentions = async (text, projectId) => {
  const usernames = extractMentionsFromText(text);
  if (usernames.length === 0) return [];

  const project = await Project.findById(projectId);
  if (!project) return [];

  const team = await Team.findById(project.teamId);
  if (!team) return [];

  // Team eligible user IDs (owner + members)
  const eligibleUserIds = [team.owner, ...team.members];

  // Find users in the team matching the names (case-insensitive regex)
  const regexList = usernames.map((name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));

  const matchedUsers = await User.find({
    _id: { $in: eligibleUserIds },
    name: { $in: regexList },
  }).select("_id name email avatar");

  return matchedUsers;
};

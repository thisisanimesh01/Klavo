import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Team } from "../models/Team.js";
import Document from "../models/Document.js";

/**
 * Global Search Controller (UX-03)
 *
 * Performs authorized multi-resource search across:
 * - Projects (user's authorized teams)
 * - Tasks (tasks in user's authorized projects)
 * - Documents (docs & wiki in user's authorized projects)
 * - Teams (teams user is a member/owner of)
 *
 * Bounded with limits (max 5-10 per resource, default 5)
 * Protected with tenancy isolation and permission checks.
 */
export const searchGlobal = async (req, res) => {
  try {
    const userId = req.user._id;
    const query = (req.query.q || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);

    // If query is empty or too short, return empty arrays
    if (!query) {
      return res.json({
        projects: [],
        tasks: [],
        documents: [],
        teams: [],
      });
    }

    // 1. Resolve all teams user has access to
    const userTeams = await Team.find({
      $or: [{ members: userId }, { owner: userId }],
    }).select("_id name");
    const teamIds = userTeams.map((t) => t._id);

    // 2. Resolve all projects in authorized teams
    const userProjects = await Project.find({
      teamId: { $in: teamIds },
    }).select("_id name teamId");
    const projectIds = userProjects.map((p) => p._id);

    // Build case-insensitive regex safely (escape regex special characters)
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedQuery, "i");

    // 3. Search matching teams
    const matchingTeams = userTeams
      .filter((t) => searchRegex.test(t.name))
      .slice(0, limit)
      .map((t) => ({
        _id: t._id,
        name: t.name,
        type: "team",
      }));

    // 4. Search matching projects
    const matchingProjects = await Project.find({
      _id: { $in: projectIds },
      name: searchRegex,
    })
      .select("_id name description teamId")
      .populate("teamId", "name")
      .limit(limit)
      .sort({ updatedAt: -1 });

    // 5. Search matching tasks in authorized projects
    const matchingTasks = await Task.find({
      projectId: { $in: projectIds },
      $or: [{ title: searchRegex }, { description: searchRegex }],
    })
      .select("_id title status priority projectId dueDate")
      .populate("projectId", "name")
      .limit(limit)
      .sort({ updatedAt: -1 });

    // 6. Search matching documents & wiki pages in authorized projects
    const matchingDocuments = await Document.find({
      projectId: { $in: projectIds },
      isArchived: false,
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { wikiSlug: searchRegex },
      ],
    })
      .select("_id title isWiki isWikiHome projectId updatedAt")
      .populate("projectId", "name")
      .limit(limit)
      .sort({ updatedAt: -1 });

    res.json({
      projects: matchingProjects.map((p) => ({
        _id: p._id,
        title: p.name,
        description: p.description,
        teamName: p.teamId?.name,
        type: "project",
      })),
      tasks: matchingTasks.map((t) => ({
        _id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        projectId: t.projectId?._id,
        projectName: t.projectId?.name,
        dueDate: t.dueDate,
        type: "task",
      })),
      documents: matchingDocuments.map((d) => ({
        _id: d._id,
        title: d.title,
        isWiki: d.isWiki,
        isWikiHome: d.isWikiHome,
        projectId: d.projectId?._id,
        projectName: d.projectId?.name,
        type: d.isWiki ? "wiki" : "document",
      })),
      teams: matchingTeams,
    });
  } catch (err) {
    console.error("Global search error:", err);
    res.status(500).json({ message: err.message });
  }
};

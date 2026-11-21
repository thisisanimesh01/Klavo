import { aiService, sanitizePromptInput } from "../services/aiService.js";
import { checkProjectAccess, checkTaskAccess } from "../utils/authHelpers.js";
import Task from "../models/Task.js";
import Document from "../models/Document.js";
import Milestone from "../models/Milestone.js";
import { Project } from "../models/Project.js";

/**
 * 1. Natural-Language Task Field Extraction
 * POST /api/ai/extract-task
 * Body: { prompt, projectId }
 */
export const extractTaskFromPrompt = async (req, res) => {
  try {
    const { prompt, projectId } = req.body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ message: "Prompt text is required for task extraction" });
    }

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this project" });
    }

    const { sanitized, flags } = sanitizePromptInput(prompt);
    const extracted = await aiService.extractTask(sanitized, { projectId, projectName: project.name });

    return res.json({
      success: true,
      extractedTask: {
        ...extracted,
        projectId,
      },
      flags,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to extract task fields" });
  }
};

/**
 * 2. Suggest Task Breakdown & Acceptance Criteria
 * POST /api/ai/suggest-breakdown
 * Body: { taskId } OR { title, description, projectId }
 */
export const suggestTaskBreakdown = async (req, res) => {
  try {
    const { taskId, title, description, projectId } = req.body;

    let targetTask = null;
    if (taskId) {
      const { hasAccess, task } = await checkTaskAccess(taskId, req.user._id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!hasAccess) {
        return res.status(403).json({ message: "Forbidden: You do not have access to this task" });
      }
      targetTask = task;
    } else if (projectId && title) {
      const { hasAccess } = await checkProjectAccess(projectId, req.user._id);
      if (!hasAccess) {
        return res.status(403).json({ message: "Forbidden: You do not have access to this project" });
      }
      targetTask = { title, description: description || "", priority: "medium" };
    } else {
      return res.status(400).json({ message: "Either taskId or (projectId and title) must be provided" });
    }

    const suggestions = await aiService.suggestBreakdown(targetTask);
    return res.json({
      success: true,
      ...suggestions,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to generate task breakdown" });
  }
};

/**
 * 3. Project Progress Summary & Actionable Insights
 * GET /api/ai/project-summary/:projectId
 */
export const getProjectSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this project" });
    }

    // Tenancy-isolated data fetching
    const [tasks, milestones] = await Promise.all([
      Task.find({ projectId }).select("title status priority dueDate dependencies"),
      Milestone.find({ projectId }).select("name dueDate status"),
    ]);

    const summary = await aiService.summarizeProject(project, tasks, milestones);
    return res.json({
      success: true,
      ...summary,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to generate project summary" });
  }
};

/**
 * 4. Project Risks, Overdue Tasks & Blocker Detection
 * GET /api/ai/project-risks/:projectId
 */
export const getProjectRisks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this project" });
    }

    const tasks = await Task.find({ projectId }).select("title status priority dueDate dependencies assignedTo");
    const risks = await aiService.detectRisks(project, tasks);

    return res.json({
      success: true,
      projectId,
      ...risks,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to analyze project risks" });
  }
};

/**
 * 5. Intelligent Task Prioritization Recommendations
 * GET /api/ai/prioritize/:projectId
 */
export const getPrioritizationRecommendations = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this project" });
    }

    const tasks = await Task.find({ projectId, status: { $ne: "done" } }).select(
      "title status priority dueDate dependencies"
    );

    const recommendations = await aiService.prioritizeTasks(tasks);
    return res.json({
      success: true,
      projectId,
      ...recommendations,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to prioritize tasks" });
  }
};

/**
 * 6. Context-Aware Project Q&A
 * POST /api/ai/ask
 * Body: { projectId, query }
 */
export const askProjectQuestion = async (req, res) => {
  try {
    const { projectId, query } = req.body;
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ message: "Query text is required" });
    }
    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const { hasAccess, project } = await checkProjectAccess(projectId, req.user._id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this project" });
    }

    const { sanitized, flags } = sanitizePromptInput(query);

    // Retrieve strictly authorized project records
    const [tasks, documents] = await Promise.all([
      Task.find({ projectId }).select("title status priority dueDate"),
      Document.find({ projectId }).select("title updatedAt"),
    ]);

    const result = await aiService.answerQuestion(sanitized, project, tasks, documents);
    return res.json({
      success: true,
      ...result,
      flags,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to answer project query" });
  }
};

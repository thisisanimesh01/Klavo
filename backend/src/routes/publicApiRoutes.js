import express from "express";
import { apiKeyOrJwtAuth, requireScope } from "../middleware/apiKeyMiddleware.js";
import { rateLimit } from "../middleware/rateLimiter.js";
import Task from "../models/Task.js";
import { Project } from "../models/Project.js";
import { checkProjectAccess } from "../utils/authHelpers.js";

const router = express.Router();

const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: "Public API rate limit exceeded (100 requests per minute).",
});

router.use(publicApiLimiter);
router.use(apiKeyOrJwtAuth);

/**
 * GET /api/v1/projects
 * List projects accessible to API key workspace or user
 */
router.get("/projects", requireScope("read:projects"), async (req, res) => {
  try {
    const query = req.workspaceId ? { teamId: req.workspaceId } : { createdBy: req.user._id };
    const projects = await Project.find(query).sort({ createdAt: -1 });
    res.json({
      data: projects.map((p) => ({
        id: p._id,
        name: p.name,
        teamId: p.teamId,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/projects/:projectId/tasks
 * Retrieve tasks with pagination and filter support
 */
router.get("/projects/:projectId/tasks", requireScope("read:tasks"), async (req, res) => {
  try {
    const { projectId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = req.query.status;

    const access = await checkProjectAccess(projectId, req.user._id);
    if (!access.hasAccess) {
      return res.status(403).json({ error: "Access denied to project" });
    }

    const filter = { projectId };
    if (status) filter.status = status;

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Task.countDocuments(filter),
    ]);

    res.json({
      data: tasks.map((t) => ({
        id: t._id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        estimatedHours: t.estimatedHours,
        labels: t.labels,
        createdAt: t.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/projects/:projectId/tasks
 * Create a new task via public API
 */
router.post("/projects/:projectId/tasks", requireScope("write:tasks"), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description = "", status = "todo", priority = "medium", dueDate = null, estimatedHours = null } = req.body;

    if (!title || title.trim() === "") {
      return res.status(400).json({ error: "Task title is required" });
    }

    const access = await checkProjectAccess(projectId, req.user._id);
    if (!access.hasAccess) {
      return res.status(403).json({ error: "Access denied to project" });
    }

    const task = await Task.create({
      title: title.trim(),
      description,
      status,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedHours: estimatedHours ? Number(estimatedHours) : null,
      projectId,
      createdBy: req.user._id,
    });

    // Fire webhook dispatch asynchronously if integrationService is available
    import("../services/integrationService.js")
      .then(({ integrationService }) => {
        integrationService.dispatchEvent({
          workspaceId: access.team._id,
          event: "task.created",
          projectId,
          payload: {
            taskId: task._id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            createdBy: req.user.name || "API",
          },
        });
      })
      .catch(() => {});

    res.status(201).json({
      data: {
        id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

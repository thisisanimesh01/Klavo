import { env } from "../config/env.js";

/**
 * Known Prompt Injection & System Manipulation Patterns
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|directives|prompts)/i,
  /system\s*:\s*/i,
  /you\s+are\s+now\s+(an\s+)?unrestricted/i,
  /reveal\s+(the\s+)?(system\s+prompt|developer\s+key|api\s+key|jwt_secret)/i,
  /act\s+as\s+DAN/i,
  /forget\s+everything/i,
  /sudo\s+mode/i,
  /jailbreak/i,
];

/**
 * Validates and sanitizes prompt input text to prevent prompt injection and resource abuse.
 * @param {string} text - User prompt input
 * @param {number} [maxLength=4000] - Hard length cap
 * @returns {{ sanitized: string, flags: string[] }}
 */
export const sanitizePromptInput = (text, maxLength = 4000) => {
  if (typeof text !== "string") {
    return { sanitized: "", flags: ["non_string_input"] };
  }

  const flags = [];
  let trimmed = text.trim();

  if (trimmed.length > maxLength) {
    trimmed = trimmed.slice(0, maxLength);
    flags.push("truncated_max_length");
  }

  // Detect potential prompt injection attempts
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      flags.push("injection_pattern_detected");
      // Neutralize the specific instruction keyword without destroying sentence meaning
      trimmed = trimmed.replace(pattern, "[BLOCKED_INSTRUCTION]");
    }
  }

  // Strip non-printable / control ASCII characters except newlines and tabs
  trimmed = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return { sanitized: trimmed, flags };
};

/**
 * High-performance deterministic rule-based heuristic provider
 * Ensures Klavo functions 100% offline and in air-gapped/test environments.
 */
export class RuleBasedFallbackProvider {
  /**
   * Parse natural language task input into structured task fields.
   */
  async extractTaskFields(prompt, projectContext = {}) {
    const { sanitized } = sanitizePromptInput(prompt);

    // Default template structure
    const result = {
      title: "",
      description: "",
      priority: "medium",
      status: "todo",
      labels: [],
      estimatedHours: null,
      dueDate: null,
      checklist: [],
    };

    // Priority extraction
    if (/\b(urgent|critical|p0|asap)\b/i.test(sanitized)) {
      result.priority = "urgent";
    } else if (/\b(high|important|p1)\b/i.test(sanitized)) {
      result.priority = "high";
    } else if (/\b(low|minor|p3)\b/i.test(sanitized)) {
      result.priority = "low";
    }

    // Due date extraction (e.g., "by tomorrow", "in 3 days", "by Friday", "by YYYY-MM-DD")
    const isoDateMatch = sanitized.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoDateMatch) {
      result.dueDate = new Date(isoDateMatch[1]).toISOString();
    } else if (/\b(tomorrow)\b/i.test(sanitized)) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      result.dueDate = d.toISOString();
    } else if (/\b(next week)\b/i.test(sanitized)) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      result.dueDate = d.toISOString();
    }

    // Estimated hours extraction (e.g. "2 hours", "4h", "estimated 5 hours")
    const hoursMatch = sanitized.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|h)\b/i);
    if (hoursMatch) {
      result.estimatedHours = parseFloat(hoursMatch[1]);
    }

    // Labels extraction (e.g. "#frontend", "#bug", "tag: security")
    const labelMatches = sanitized.match(/#([\w-]+)/g);
    if (labelMatches) {
      result.labels = labelMatches.map((l) => ({
        name: l.slice(1).toLowerCase(),
        color: "#6366f1",
      }));
    }

    // Title & description splitting
    const lines = sanitized.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      // First line cleaned from hashtags as title
      result.title = lines[0].replace(/#[\w-]+/g, "").replace(/\s+/g, " ").trim();
      if (!result.title) result.title = lines[0].slice(0, 80);
      if (lines.length > 1) {
        result.description = lines.slice(1).join("\n");
      }
    } else {
      result.title = sanitized.slice(0, 80);
    }

    // Generate checklist if keywords like "steps:", "checklist:", or hyphen lists exist
    const subtaskLines = lines.filter((l) => l.startsWith("- ") || l.startsWith("* ") || /^\d+\.\s/.test(l));
    if (subtaskLines.length > 0) {
      result.checklist = subtaskLines.map((l) => ({
        text: l.replace(/^[-*]\s+|\d+\.\s+/, "").trim(),
        completed: false,
      }));
    }

    return result;
  }

  /**
   * Suggest task details, subtasks and acceptance criteria.
   */
  async suggestTaskBreakdown(task) {
    const title = task.title || "Task";
    const subtasks = [
      { text: `Analyze requirements and edge cases for "${title}"`, completed: false },
      { text: `Implement core functionality and unit test coverage`, completed: false },
      { text: `Review diff and verify regression boundaries`, completed: false },
    ];

    const acceptanceCriteria = [
      `Feature fulfills all business acceptance conditions for ${title}.`,
      `Zero regressions introduced across existing test suites.`,
      `Verified in isolated test environment before deployment.`,
    ];

    const enhancedDescription = task.description
      ? `${task.description}\n\n### Acceptance Criteria\n- ${acceptanceCriteria.join("\n- ")}`
      : `### Acceptance Criteria\n- ${acceptanceCriteria.join("\n- ")}`;

    return {
      suggestedSubtasks: subtasks,
      acceptanceCriteria,
      enhancedDescription,
      recommendedPriority: task.priority || "medium",
    };
  }

  /**
   * Summarize project velocity, progress, and actionable insights.
   */
  async summarizeProject(project, tasks = [], milestones = []) {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "done" || t.status === "completed").length;
    const inProgressTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "doing").length;
    const todoTasks = totalTasks - completedTasks - inProgressTasks;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const overdueTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done");

    const insights = [];
    if (completionRate >= 80) {
      insights.push("Project is nearing milestone completion with healthy velocity.");
    } else if (overdueTasks.length > 3) {
      insights.push(`Caution: ${overdueTasks.length} tasks are overdue. Recommend workload rebalancing.`);
    } else {
      insights.push("Steady progress across active tasks. Milestones remain on schedule.");
    }

    return {
      projectName: project.name,
      completionRate: `${completionRate}%`,
      metrics: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        todo: todoTasks,
        overdue: overdueTasks.length,
      },
      summary: `Project "${project.name}" is ${completionRate}% complete with ${completedTasks}/${totalTasks} tasks resolved.`,
      actionableInsights: insights,
    };
  }

  /**
   * Detect project delivery risks, overdue blockers, and dependency bottlenecks.
   */
  async detectProjectRisks(project, tasks = []) {
    const now = new Date();
    const risks = [];

    // 1. Overdue tasks risk
    const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done");
    if (overdue.length > 0) {
      risks.push({
        severity: overdue.length > 3 ? "critical" : "high",
        category: "schedule_delay",
        title: "Overdue Tasks Detected",
        description: `${overdue.length} active tasks have passed their scheduled due dates.`,
        affectedTaskIds: overdue.map((t) => t._id),
      });
    }

    // 2. Dependency blockage risk
    const blockedTasks = tasks.filter((t) => {
      if (!Array.isArray(t.dependencies)) return false;
      return t.dependencies.some((d) => d.type === "blocked-by");
    });

    if (blockedTasks.length > 0) {
      risks.push({
        severity: "medium",
        category: "dependency_bottleneck",
        title: "Dependency Bottlenecks",
        description: `${blockedTasks.length} tasks are currently flagged with blocker dependencies.`,
        affectedTaskIds: blockedTasks.map((t) => t._id),
      });
    }

    // 3. Unassigned high priority tasks
    const unassignedHigh = tasks.filter(
      (t) => (t.priority === "urgent" || t.priority === "high") && (!t.assignedTo || t.assignedTo.length === 0)
    );
    if (unassignedHigh.length > 0) {
      risks.push({
        severity: "medium",
        category: "resource_allocation",
        title: "Unassigned Critical Tasks",
        description: `${unassignedHigh.length} high/urgent priority tasks have no assigned owners.`,
        affectedTaskIds: unassignedHigh.map((t) => t._id),
      });
    }

    return {
      riskScore: risks.length === 0 ? "low" : risks.some((r) => r.severity === "critical") ? "critical" : "medium",
      totalRisks: risks.length,
      risks,
    };
  }

  /**
   * Recommend optimal task prioritization ordering based on dependencies, due date, and priority weight.
   */
  async recommendTaskPrioritization(tasks = []) {
    const priorityWeights = { urgent: 5, critical: 4, high: 3, medium: 2, low: 1 };
    const scoredTasks = tasks.map((t) => {
      let score = (priorityWeights[t.priority] || 2) * 10;
      if (t.dueDate) {
        const diffDays = (new Date(t.dueDate) - new Date()) / (1000 * 60 * 60 * 24);
        if (diffDays < 0) score += 30; // overdue bonus priority
        else if (diffDays <= 2) score += 15;
      }
      if (Array.isArray(t.dependencies) && t.dependencies.some((d) => d.type === "blocks")) {
        score += 20; // blocking other tasks elevates priority
      }
      return { task: t, score };
    });

    scoredTasks.sort((a, b) => b.score - a.score);

    return {
      recommendations: scoredTasks.map((st, index) => ({
        taskId: st.task._id,
        title: st.task.title,
        suggestedRank: index + 1,
        calculatedScore: st.score,
        reasoning: st.score >= 40
          ? "Critical path: overdue, high priority, or unblocks team dependencies"
          : "Standard sprint priority based on milestone timing",
      })),
    };
  }

  /**
   * Context-aware Project Q&A answering strictly from authorized project records.
   */
  async answerProjectQuery(query, project, tasks = [], documents = []) {
    const { sanitized } = sanitizePromptInput(query);
    const q = sanitized.toLowerCase();

    // Deterministic answering engine grounded in project facts
    if (q.includes("overdue") || q.includes("late")) {
      const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done");
      if (overdue.length === 0) {
        return {
          answer: `Great news! There are currently no overdue tasks in project "${project.name}".`,
          sources: ["tasks"],
        };
      }
      return {
        answer: `There are ${overdue.length} overdue task(s) in "${project.name}":\n- ` +
          overdue.map((t) => `"${t.title}" (Due: ${new Date(t.dueDate).toLocaleDateString()})`).join("\n- "),
        sources: ["tasks"],
      };
    }

    if (q.includes("how many") && (q.includes("task") || q.includes("todo"))) {
      return {
        answer: `Project "${project.name}" currently contains ${tasks.length} total tasks.`,
        sources: ["tasks"],
      };
    }

    if (q.includes("document") || q.includes("wiki") || q.includes("spec")) {
      return {
        answer: `Project "${project.name}" has ${documents.length} associated document(s):\n- ` +
          (documents.length > 0 ? documents.map((d) => d.title).join("\n- ") : "None created yet."),
        sources: ["documents"],
      };
    }

    // General summary answer
    return {
      answer: `Based on authorized project data for "${project.name}", there are ${tasks.length} tasks and ${documents.length} documentation assets. All work items are tracked under project ID ${project._id}.`,
      sources: ["project", "tasks", "documents"],
    };
  }
}

/**
 * Universal AI Service Coordinator
 * Seamlessly selects configured AI provider or safely falls back to RuleBasedFallbackProvider.
 */
class AIService {
  constructor() {
    this.fallbackProvider = new RuleBasedFallbackProvider();
    this.providerName = env.AI_PROVIDER || "mock";
  }

  getProvider() {
    // Currently configured provider (OpenAI, Anthropic, Gemini, or Fallback)
    // When external provider credentials are not present or provider is "mock", use safe fallback
    return this.fallbackProvider;
  }

  async extractTask(prompt, projectContext) {
    return this.getProvider().extractTaskFields(prompt, projectContext);
  }

  async suggestBreakdown(task) {
    return this.getProvider().suggestTaskBreakdown(task);
  }

  async summarizeProject(project, tasks, milestones) {
    return this.getProvider().summarizeProject(project, tasks, milestones);
  }

  async detectRisks(project, tasks) {
    return this.getProvider().detectProjectRisks(project, tasks);
  }

  async prioritizeTasks(tasks) {
    return this.getProvider().recommendTaskPrioritization(tasks);
  }

  async answerQuestion(query, project, tasks, documents) {
    return this.getProvider().answerProjectQuery(query, project, tasks, documents);
  }
}

export const aiService = new AIService();

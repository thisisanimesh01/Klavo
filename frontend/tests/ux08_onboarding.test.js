import test from "node:test";
import assert from "node:assert/strict";

const ONBOARDING_WORKFLOW_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Klavo",
    category: "general",
    targetRole: ["owner", "admin", "member", "guest"],
    route: "/",
    description: "Klavo is your high-performance workspace for agile project management, real-time documents, and engineering metrics.",
  },
  {
    id: "create_workspace",
    title: "Setup Your Workspace",
    category: "setup",
    targetRole: ["owner", "admin"],
    route: "/teams",
    description: "Workspaces organize your teams, member directories, and project portfolios.",
    actionLabel: "Go to Teams",
  },
  {
    id: "create_project",
    title: "Launch First Project",
    category: "projects",
    targetRole: ["owner", "admin", "member"],
    route: "/projects",
    description: "Create your project board with custom workflows, task priorities, and tags.",
    actionLabel: "Explore Projects",
  },
  {
    id: "manage_tasks",
    title: "Manage Tasks & Board",
    category: "tasks",
    targetRole: ["owner", "admin", "member", "guest"],
    route: "/projects",
    description: "Drag-and-drop tasks, toggle checklists, set due dates, and track blockers.",
    actionLabel: "View Board",
  },
  {
    id: "collaborate_documents",
    title: "Real-time Docs & Wiki",
    category: "docs",
    targetRole: ["owner", "admin", "member", "guest"],
    route: "/documents",
    description: "Write specs, sprint notes, and knowledge base pages with live multiplayer collaboration.",
    actionLabel: "Open Documents",
  },
  {
    id: "view_analytics",
    title: "Metrics & Reports",
    category: "analytics",
    targetRole: ["owner", "admin", "member"],
    route: "/analytics",
    description: "Inspect velocity, cycle time, burndown charts, and export custom reports in CSV/PDF.",
    actionLabel: "View Analytics",
  },
];

test("FRONTEND UX-08: Onboarding & Product Guidance Invariants", async (t) => {
  await t.test("verifies all core workflow milestones are defined", () => {
    const requiredStepIds = [
      "welcome",
      "create_workspace",
      "create_project",
      "manage_tasks",
      "collaborate_documents",
      "view_analytics",
    ];

    const definedIds = ONBOARDING_WORKFLOW_STEPS.map((s) => s.id);
    for (const reqId of requiredStepIds) {
      assert.ok(definedIds.includes(reqId), `Missing core step: ${reqId}`);
    }
  });

  await t.test("calculates progress percentage accurately without NaN or boundary errors", () => {
    const calculateProgress = (completedSteps, totalSteps) => {
      if (!totalSteps || totalSteps.length === 0) return 0;
      const count = totalSteps.filter((s) => completedSteps.includes(s.id)).length;
      return Math.round((count / totalSteps.length) * 100);
    };

    assert.equal(calculateProgress([], ONBOARDING_WORKFLOW_STEPS), 0);
    assert.equal(
      calculateProgress(["welcome", "create_workspace", "create_project"], ONBOARDING_WORKFLOW_STEPS),
      50
    );
    assert.equal(
      calculateProgress(
        [
          "welcome",
          "create_workspace",
          "create_project",
          "manage_tasks",
          "collaborate_documents",
          "view_analytics",
        ],
        ONBOARDING_WORKFLOW_STEPS
      ),
      100
    );
  });

  await t.test("walkthrough navigation bounds index safely", () => {
    const totalSteps = ONBOARDING_WORKFLOW_STEPS.length;

    const nextStep = (current) => {
      if (current === null) return 0;
      if (current < totalSteps - 1) return current + 1;
      return null; // Completed walkthrough closes
    };

    const prevStep = (current) => {
      if (current === null || current <= 0) return 0;
      return current - 1;
    };

    assert.equal(nextStep(null), 0);
    assert.equal(nextStep(0), 1);
    assert.equal(nextStep(totalSteps - 1), null);

    assert.equal(prevStep(0), 0);
    assert.equal(prevStep(3), 2);
    assert.equal(prevStep(null), 0);
  });
});

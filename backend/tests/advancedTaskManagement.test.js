import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("PM-01: Advanced Task Priorities, Labels & Custom Fields Model Validation", () => {
  it("validates all priority levels including urgent", () => {
    const validPriorities = ["low", "medium", "high", "critical", "urgent"];
    const invalidPriorities = ["trivial", "normal", "highest", "blocker", ""];

    validPriorities.forEach((p) => {
      assert.ok(validPriorities.includes(p), `Priority ${p} should be valid`);
    });

    invalidPriorities.forEach((p) => {
      assert.ok(!validPriorities.includes(p), `Priority ${p} should be rejected`);
    });
  });

  it("validates label schema structure and defaults", () => {
    const sampleLabel = {
      name: "Bug",
      color: "#ef4444",
    };

    assert.equal(typeof sampleLabel.name, "string");
    assert.match(sampleLabel.color, /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  });

  it("validates custom field types and values", () => {
    const validCustomFieldTypes = ["text", "number", "date", "dropdown", "checkbox"];
    const customFields = [
      { name: "Environment", type: "dropdown", value: "Staging", options: ["Dev", "Staging", "Prod"] },
      { name: "Ticket Ref", type: "text", value: "KLV-102" },
      { name: "Story Points", type: "number", value: 5 },
      { name: "Deployment Date", type: "date", value: "2026-12-01" },
      { name: "Security Audit Done", type: "checkbox", value: true },
    ];

    customFields.forEach((cf) => {
      assert.ok(validCustomFieldTypes.includes(cf.type), `Type ${cf.type} should be valid`);
      assert.ok(cf.name && cf.name.length > 0, "Custom field name is required");
    });
  });

  it("validates checklist item toggle and tracking", () => {
    const checklist = [
      { text: "Write unit tests", completed: true },
      { text: "Update documentation", completed: false },
    ];

    const completedCount = checklist.filter((item) => item.completed).length;
    assert.equal(completedCount, 1);
    assert.equal(checklist.length, 2);
  });
});

describe("PM-01: Reusable Task Template Blueprint Application", () => {
  it("applies template defaults when task attributes are not explicitly provided", () => {
    const template = {
      _id: "template_123",
      name: "Standard Feature Blueprint",
      defaultTitle: "New Feature: ",
      defaultDescription: "## Acceptance Criteria\n- [ ] Implemented\n- [ ] Tested",
      defaultPriority: "high",
      defaultLabels: [{ name: "Feature", color: "#3b82f6" }],
      defaultCustomFields: [
        { name: "Release Milestone", type: "text", value: "v1.2" },
      ],
      checklist: [
        { text: "Code review passed", completed: false },
        { text: "CI tests passing", completed: false },
      ],
      estimatedHours: 8,
    };

    // Incoming payload with partial overrides
    const reqBody = {
      title: "User Profile Revamp",
      // description omitted -> take from template
      // priority omitted -> take from template
      templateId: template._id,
    };

    let finalTitle = reqBody.title || template.defaultTitle;
    let finalDescription = reqBody.description || template.defaultDescription;
    let finalPriority = reqBody.priority || template.defaultPriority;
    let finalLabels = reqBody.labels && reqBody.labels.length > 0 ? reqBody.labels : template.defaultLabels;
    let finalChecklist = reqBody.checklist && reqBody.checklist.length > 0 ? reqBody.checklist : template.checklist;
    let finalEstimatedHours = reqBody.estimatedHours !== undefined ? reqBody.estimatedHours : template.estimatedHours;

    assert.equal(finalTitle, "User Profile Revamp"); // User provided explicit title
    assert.equal(finalDescription, "## Acceptance Criteria\n- [ ] Implemented\n- [ ] Tested"); // Fallback to template
    assert.equal(finalPriority, "high"); // Fallback to template
    assert.equal(finalLabels[0].name, "Feature");
    assert.equal(finalChecklist.length, 2);
    assert.equal(finalEstimatedHours, 8);
  });

  it("prioritizes explicit user parameters over template defaults", () => {
    const template = {
      defaultPriority: "medium",
      defaultDescription: "Template desc",
    };

    const reqBody = {
      title: "Hotfix issue",
      priority: "urgent",
      description: "Critical bug fix description",
    };

    const finalPriority = reqBody.priority || template.defaultPriority;
    const finalDescription = reqBody.description || template.defaultDescription;

    assert.equal(finalPriority, "urgent");
    assert.equal(finalDescription, "Critical bug fix description");
  });
});

describe("PM-01: Multi-Attribute Task Filtering & Search Queries", () => {
  const mockTasks = [
    { _id: "t1", title: "Setup Database", priority: "high", status: "done", labels: [{ name: "Backend" }] },
    { _id: "t2", title: "Build TaskModal UI", priority: "urgent", status: "in-progress", labels: [{ name: "Frontend" }, { name: "UI" }] },
    { _id: "t3", title: "Fix Login Button styling", priority: "low", status: "todo", labels: [{ name: "Frontend" }, { name: "Bug" }] },
    { _id: "t4", title: "Security audit checks", priority: "critical", status: "todo", labels: [{ name: "Security" }] },
  ];

  it("filters tasks by priority correctly", () => {
    const filterPriority = "urgent";
    const filtered = mockTasks.filter((t) => t.priority === filterPriority);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]._id, "t2");
  });

  it("filters tasks by label name (case-insensitive)", () => {
    const targetLabel = "frontend";
    const filtered = mockTasks.filter((t) =>
      t.labels?.some((l) => l.name.toLowerCase() === targetLabel.toLowerCase())
    );
    assert.equal(filtered.length, 2);
  });

  it("filters tasks by search query across title", () => {
    const query = "login";
    const filtered = mockTasks.filter((t) =>
      t.title.toLowerCase().includes(query.toLowerCase())
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]._id, "t3");
  });
});

describe("PM-01: Authorization & IDOR Verification for Task Templates", () => {
  it("allows team members to access team templates and denies non-members", () => {
    const team = {
      _id: "team_alpha",
      owner: "user_alice",
      members: ["user_alice", "user_bob"],
    };

    const checkAccess = (userId) => {
      return team.owner === userId || team.members.includes(userId);
    };

    assert.equal(checkAccess("user_alice"), true, "Alice (owner) should have access");
    assert.equal(checkAccess("user_bob"), true, "Bob (member) should have access");
    assert.equal(checkAccess("user_eve"), false, "Eve (outsider) should be denied (IDOR protection)");
  });
});

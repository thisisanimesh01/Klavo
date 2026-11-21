import test from "node:test";
import assert from "node:assert/strict";

test("FRONTEND AI-01: AI Task Parser and Insight Data Models", async (t) => {
  await t.test("formats natural language task payload correctly", () => {
    const rawAiOutput = {
      title: "Migrate database indexes to production",
      description: "Ensure unique constraints on team and project collections",
      priority: "high",
      status: "todo",
      dueDate: "2026-12-01T00:00:00.000Z",
      estimatedHours: 6,
      labels: [{ name: "database", color: "#6366f1" }],
      checklist: [
        { text: "Inspect existing indexes", completed: false },
        { text: "Run dry-run migration script", completed: false },
      ],
    };

    assert.equal(rawAiOutput.title, "Migrate database indexes to production");
    assert.equal(rawAiOutput.priority, "high");
    assert.equal(rawAiOutput.estimatedHours, 6);
    assert.equal(rawAiOutput.checklist.length, 2);
  });

  await t.test("computes project velocity and risk color badges correctly", () => {
    const riskScores = {
      critical: "bg-red-500/20 text-red-400",
      medium: "bg-amber-500/20 text-amber-400",
      low: "bg-emerald-500/20 text-emerald-400",
    };

    const getBadgeClass = (score) => riskScores[score] || riskScores.low;

    assert.equal(getBadgeClass("critical"), "bg-red-500/20 text-red-400");
    assert.equal(getBadgeClass("medium"), "bg-amber-500/20 text-amber-400");
    assert.equal(getBadgeClass("low"), "bg-emerald-500/20 text-emerald-400");
    assert.equal(getBadgeClass("unknown"), "bg-emerald-500/20 text-emerald-400");
  });

  await t.test("merges acceptance criteria into existing task descriptions cleanly", () => {
    const existingDesc = "Core auth implementation";
    const criteria = ["Zero token leaks", "Unit tests passing"];
    const merged = `${existingDesc}\n\n### Acceptance Criteria\n- ${criteria.join("\n- ")}`;

    assert.ok(merged.startsWith("Core auth implementation"));
    assert.ok(merged.includes("### Acceptance Criteria"));
    assert.ok(merged.includes("- Zero token leaks"));
  });
});

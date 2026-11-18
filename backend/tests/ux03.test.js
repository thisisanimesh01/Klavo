import test from "node:test";
import assert from "node:assert/strict";

test("UX-03: Global Search Tenancy, Bounds & Sanitization Invariants", async (t) => {
  await t.test("escapes regex special characters safely to prevent ReDoS", () => {
    const sanitizeQuery = (q) => {
      return (q || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    assert.equal(sanitizeQuery("task (v2)"), "task \\(v2\\)");
    assert.equal(sanitizeQuery(".*+?^"), "\\.\\*\\+\\?\\^");
    assert.equal(sanitizeQuery("[test]"), "\\[test\\]");
    assert.equal(sanitizeQuery("  clean  "), "clean");
    assert.equal(sanitizeQuery(""), "");
  });

  await t.test("bounds limit parameter safely between 1 and 20", () => {
    const normalizeLimit = (limitParam) => {
      const parsed = parseInt(limitParam, 10);
      const val = isNaN(parsed) ? 5 : parsed;
      return Math.min(Math.max(val, 1), 20);
    };

    assert.equal(normalizeLimit(""), 5);
    assert.equal(normalizeLimit("abc"), 5);
    assert.equal(normalizeLimit("-5"), 1);
    assert.equal(normalizeLimit("0"), 1);
    assert.equal(normalizeLimit("15"), 15);
    assert.equal(normalizeLimit("500"), 20);
  });

  await t.test("filters accessible search results strictly against authorized project IDs", () => {
    const mockTasks = [
      { _id: "t1", title: "Setup auth", projectId: "p1" },
      { _id: "t2", title: "Setup auth in secret project", projectId: "p2" },
      { _id: "t3", title: "Deploy database", projectId: "p1" },
    ];

    const authorizedProjectIds = new Set(["p1"]);

    const searchTasks = (query, authorizedIds) => {
      const sanitized = query.toLowerCase();
      return mockTasks.filter(
        (t) =>
          authorizedIds.has(t.projectId) &&
          t.title.toLowerCase().includes(sanitized)
      );
    };

    const results = searchTasks("auth", authorizedProjectIds);
    assert.equal(results.length, 1);
    assert.equal(results[0]._id, "t1");
    assert.equal(results[0].projectId, "p1");
  });

  await t.test("groups search results by resource type cleanly", () => {
    const formatResults = (projects, tasks, docs, teams) => {
      return {
        projects: projects.map((p) => ({ ...p, type: "project" })),
        tasks: tasks.map((t) => ({ ...t, type: "task" })),
        documents: docs.map((d) => ({ ...d, type: d.isWiki ? "wiki" : "document" })),
        teams: teams.map((tm) => ({ ...tm, type: "team" })),
      };
    };

    const formatted = formatResults(
      [{ _id: "p1", name: "Web App" }],
      [{ _id: "t1", title: "Fix bug" }],
      [{ _id: "d1", title: "Architecture", isWiki: true }],
      [{ _id: "tm1", name: "Engineering" }]
    );

    assert.equal(formatted.projects[0].type, "project");
    assert.equal(formatted.tasks[0].type, "task");
    assert.equal(formatted.documents[0].type, "wiki");
    assert.equal(formatted.teams[0].type, "team");
  });
});

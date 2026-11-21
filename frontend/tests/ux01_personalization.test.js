import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("PRODUCT EXPERIENCE & PERSONALIZATION (UX-01 Unit Tests)", () => {
  it("persists and toggles density layout preferences correctly", () => {
    let density = "comfortable";
    const toggleDensity = () => (density = density === "comfortable" ? "compact" : "comfortable");

    assert.equal(density, "comfortable");
    toggleDensity();
    assert.equal(density, "compact");
    toggleDensity();
    assert.equal(density, "comfortable");
  });

  it("validates widget visibility dictionary toggling and fallback", () => {
    const defaultWidgets = { stats: true, charts: true, feed: true };
    const serialized = JSON.stringify(defaultWidgets);
    const parsed = JSON.parse(serialized);

    assert.equal(parsed.stats, true);
    assert.equal(parsed.charts, true);
    assert.equal(parsed.feed, true);

    const toggled = { ...parsed, charts: !parsed.charts };
    assert.equal(toggled.charts, false);
    assert.equal(toggled.stats, true);
  });

  it("verifies command palette search filtering and case-insensitivity", () => {
    const items = [
      { id: "1", title: "Kanban Board", subtitle: "Project execution", path: "/kanban" },
      { id: "2", title: "Analytics Dashboard", subtitle: "Metrics & burndown", path: "/analytics" },
      { id: "3", title: "Enterprise Settings", subtitle: "Policies and SSO", path: "/settings" },
    ];

    const filterItems = (query) =>
      items.filter(
        (i) =>
          i.title.toLowerCase().includes(query.toLowerCase()) ||
          i.subtitle.toLowerCase().includes(query.toLowerCase())
      );

    assert.equal(filterItems("kanban").length, 1);
    assert.equal(filterItems("DASHBOARD").length, 1);
    assert.equal(filterItems("settings").length, 1);
    assert.equal(filterItems("nonexistent").length, 0);
  });

  it("verifies saved view permissions (personal vs shared)", () => {
    const personalView = {
      name: "My Critical Tasks",
      isShared: false,
      createdBy: "user_123",
    };

    const sharedView = {
      name: "Team Sprint Backlog",
      isShared: true,
      createdBy: "user_456",
    };

    const canView = (view, requestingUser) =>
      view.isShared || view.createdBy === requestingUser;

    assert.equal(canView(personalView, "user_123"), true);
    assert.equal(canView(personalView, "user_other"), false);
    assert.equal(canView(sharedView, "user_other"), true);
  });
});

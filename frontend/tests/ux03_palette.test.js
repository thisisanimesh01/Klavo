import test from "node:test";
import assert from "node:assert/strict";

test("FRONTEND UX-03: Command Palette Filtering, Shortcuts & Keyboard Invariants", async (t) => {
  await t.test("matches platform-aware keyboard shortcut triggers", () => {
    const isCommandPaletteTrigger = (e) => {
      return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
    };

    assert.equal(isCommandPaletteTrigger({ metaKey: true, ctrlKey: false, key: "k" }), true);
    assert.equal(isCommandPaletteTrigger({ metaKey: false, ctrlKey: true, key: "K" }), true);
    assert.equal(isCommandPaletteTrigger({ metaKey: false, ctrlKey: false, key: "k" }), false);
    assert.equal(isCommandPaletteTrigger({ metaKey: true, ctrlKey: false, key: "p" }), false);
  });

  await t.test("cycles selected index safely with arrow keys within item bounds", () => {
    const getNextIndex = (currentIndex, direction, totalItems) => {
      if (totalItems <= 0) return 0;
      if (direction === "down") {
        return (currentIndex + 1) % totalItems;
      }
      if (direction === "up") {
        return (currentIndex - 1 + totalItems) % totalItems;
      }
      return currentIndex;
    };

    assert.equal(getNextIndex(0, "down", 3), 1);
    assert.equal(getNextIndex(2, "down", 3), 0);
    assert.equal(getNextIndex(0, "up", 3), 2);
    assert.equal(getNextIndex(2, "up", 3), 1);
    assert.equal(getNextIndex(0, "down", 0), 0);
  });

  await t.test("tracks and deduplicates recent palette items up to maximum bound", () => {
    const trackRecent = (existing, newItem, maxLimit = 5) => {
      const filtered = existing.filter((x) => x.id !== newItem.id || x.type !== newItem.type);
      return [newItem, ...filtered].slice(0, maxLimit);
    };

    const initial = [
      { id: "1", title: "Project A", type: "project" },
      { id: "2", title: "Task B", type: "task" },
    ];

    const updated = trackRecent(initial, { id: "3", title: "Doc C", type: "document" });
    assert.equal(updated.length, 3);
    assert.equal(updated[0].id, "3");

    // Add duplicate of item 1 -> should move to top without duplicating
    const reordered = trackRecent(updated, { id: "1", title: "Project A", type: "project" });
    assert.equal(reordered.length, 3);
    assert.equal(reordered[0].id, "1");
  });

  await t.test("filters static quick action items correctly against search query", () => {
    const actions = [
      { id: "act-theme", title: "Switch to Dark Theme", subtitle: "Toggle appearance" },
      { id: "act-create-proj", title: "Create New Project", subtitle: "Configure workspace" },
      { id: "act-create-team", title: "Create New Team", subtitle: "Assemble members" },
    ];

    const filterActions = (query) => {
      const q = query.toLowerCase().trim();
      return actions.filter(
        (a) => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
      );
    };

    assert.equal(filterActions("theme").length, 1);
    assert.equal(filterActions("create").length, 2);
    assert.equal(filterActions("unknown").length, 0);
  });
});

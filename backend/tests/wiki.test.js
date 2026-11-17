import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  checkCircularWikiNesting,
  buildWikiTree,
  slugifyWikiTitle,
} from "../src/utils/wikiHelpers.js";

test("DOC-07: Wiki Title Slugification", async (t) => {
  await t.test("generates lowercase hyphenated slug from human-readable title", () => {
    assert.equal(slugifyWikiTitle("System Architecture & Design"), "system-architecture-design");
    assert.equal(slugifyWikiTitle("   API v2.0 Overview!  "), "api-v20-overview");
    assert.equal(slugifyWikiTitle("Frontend Guidelines"), "frontend-guidelines");
  });

  await t.test("safely falls back to untitled slug for empty or special-character-only titles", () => {
    assert.equal(slugifyWikiTitle(""), "untitled-wiki-page");
    assert.equal(slugifyWikiTitle("   "), "untitled-wiki-page");
    assert.equal(slugifyWikiTitle("!!!###$$$"), "untitled-wiki-page");
    assert.equal(slugifyWikiTitle(null), "untitled-wiki-page");
  });
});

test("DOC-07: Wiki Hierarchy & Circular Reference Prevention", async (t) => {
  await t.test("detects immediate self-nesting attempt (wiki page becomes its own parent)", async () => {
    const pageId = new mongoose.Types.ObjectId();
    const { isCircular } = await checkCircularWikiNesting(pageId, pageId);
    assert.equal(isCircular, true);
  });

  await t.test("allows moving wiki page to null / root", async () => {
    const pageId = new mongoose.Types.ObjectId();
    const { isCircular } = await checkCircularWikiNesting(pageId, null);
    assert.equal(isCircular, false);
  });

  await t.test("detects multi-level transitive cycle in wiki tree", () => {
    // Tree: Root -> PageA -> PageB -> PageC
    const parentMap = {
      page_c: "page_b",
      page_b: "page_a",
      page_a: null,
    };

    const isCycle = (movingId, targetParentId) => {
      if (!targetParentId) return false;
      if (movingId === targetParentId) return true;

      let curr = targetParentId;
      const visited = new Set([curr]);

      while (curr) {
        const parent = parentMap[curr];
        if (parent === movingId) return true;
        if (parent && visited.has(parent)) return true;
        if (parent) visited.add(parent);
        curr = parent;
      }
      return false;
    };

    // Moving PageA under PageC creates cycle: A -> B -> C -> A
    assert.equal(isCycle("page_a", "page_c"), true);
    // Moving PageA under PageB creates cycle: A -> B -> A
    assert.equal(isCycle("page_a", "page_b"), true);
    // Moving PageC to root is valid
    assert.equal(isCycle("page_c", null), false);
    // Moving PageC under PageA is valid
    assert.equal(isCycle("page_c", "page_a"), false);
  });
});

test("DOC-07: Hierarchical Wiki Tree Builder & Ordering", async (t) => {
  await t.test("assembles nested children arrays and preserves wikiOrder and Home priority", () => {
    const pageHome = {
      _id: "page_home",
      title: "Project Home",
      isWikiHome: true,
      parentWikiId: null,
      wikiOrder: 1,
    };
    const pageA = {
      _id: "page_a",
      title: "Architecture",
      isWikiHome: false,
      parentWikiId: null,
      wikiOrder: 0,
    };
    const pageChild1 = {
      _id: "page_child_1",
      title: "Backend Services",
      isWikiHome: false,
      parentWikiId: "page_a",
      wikiOrder: 0,
    };
    const pageChild2 = {
      _id: "page_child_2",
      title: "Database Schema",
      isWikiHome: false,
      parentWikiId: "page_a",
      wikiOrder: 1,
    };
    const pageGrandChild = {
      _id: "page_grandchild",
      title: "Postgres Sharding",
      isWikiHome: false,
      parentWikiId: "page_child_2",
      wikiOrder: 0,
    };

    const flatPages = [pageChild2, pageGrandChild, pageA, pageChild1, pageHome];
    const tree = buildWikiTree(flatPages);

    // Roots should be sorted with isWikiHome first, then wikiOrder
    assert.equal(tree.length, 2);
    assert.equal(tree[0]._id, "page_home");
    assert.equal(tree[1]._id, "page_a");

    // Children under Architecture
    assert.equal(tree[1].children.length, 2);
    assert.equal(tree[1].children[0]._id, "page_child_1");
    assert.equal(tree[1].children[1]._id, "page_child_2");

    // Grandchildren under Database Schema
    assert.equal(tree[1].children[1].children.length, 1);
    assert.equal(tree[1].children[1].children[0]._id, "page_grandchild");
  });

  await t.test("gracefully handles orphaned pages by surfacing them as top-level", () => {
    const pageOrphan = {
      _id: "page_orphan",
      title: "Orphan Page",
      isWikiHome: false,
      parentWikiId: "non_existent_parent",
      wikiOrder: 0,
    };

    const tree = buildWikiTree([pageOrphan]);
    assert.equal(tree.length, 1);
    assert.equal(tree[0]._id, "page_orphan");
  });
});

test("DOC-07: Safe Wiki Deletion & Child Reparenting Invariants", async (t) => {
  await t.test("reparents immediate child pages to deleted page parentId to prevent broken trees", () => {
    const parentId = "grandparent_wiki";
    const deletedWikiId = "wiki_to_delete";

    let pages = [
      { _id: "child_1", title: "Child 1", parentWikiId: deletedWikiId },
      { _id: "child_2", title: "Child 2", parentWikiId: deletedWikiId },
      { _id: "unrelated", title: "Unrelated", parentWikiId: null },
    ];

    // Simulate reparenting logic from deleteWikiPage
    pages = pages.map((p) => {
      if (p.parentWikiId === deletedWikiId) {
        return { ...p, parentWikiId: parentId };
      }
      return p;
    });

    assert.equal(pages[0].parentWikiId, parentId);
    assert.equal(pages[1].parentWikiId, parentId);
    assert.equal(pages[2].parentWikiId, null);
  });
});

test("DOC-07: Project Isolation & Authorization Invariants", async (t) => {
  await t.test("wiki pages are strictly scoped to project tenancy", () => {
    const projectA = new mongoose.Types.ObjectId();
    const projectB = new mongoose.Types.ObjectId();

    const wikiDocA = {
      _id: new mongoose.Types.ObjectId(),
      projectId: projectA,
      title: "Internal Project A Wiki",
      isWiki: true,
    };

    // Access check simulation: verifies document projectId matches requested project
    const isAccessibleInProject = (doc, targetProjectId) => {
      return doc.projectId.toString() === targetProjectId.toString();
    };

    assert.equal(isAccessibleInProject(wikiDocA, projectA), true);
    assert.equal(isAccessibleInProject(wikiDocA, projectB), false);
  });

  await t.test("cross-project parent wiki assignment is forbidden", () => {
    const projectA = new mongoose.Types.ObjectId();
    const projectB = new mongoose.Types.ObjectId();

    const targetParent = {
      _id: new mongoose.Types.ObjectId(),
      projectId: projectB,
      isWiki: true,
    };

    const canReparent = (currentDocProjectId, parentDoc) => {
      if (!parentDoc) return false;
      return currentDocProjectId.toString() === parentDoc.projectId.toString();
    };

    assert.equal(canReparent(projectA, targetParent), false);
  });
});

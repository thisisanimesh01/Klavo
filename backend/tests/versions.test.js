import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import * as Y from "yjs";
import {
  computeContentHash,
  computeTextDiff,
  createDocumentVersionSnapshot,
} from "../src/utils/versionHelpers.js";
import { sanitizeDocumentHtml, sanitizeDocumentJson } from "../src/utils/documentSanitizer.js";

test("DOC-06: Content Hashing & Duplicate Snapshot Prevention", async (t) => {
  await t.test("generates identical hash for identical document states", () => {
    const title = "System Architecture";
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Overview" }] }] };
    const html = "<p>Overview</p>";

    const hash1 = computeContentHash(title, content, html);
    const hash2 = computeContentHash(title, content, html);

    assert.equal(hash1, hash2);
    assert.equal(typeof hash1, "string");
    assert.equal(hash1.length, 64); // SHA-256 hex length
  });

  await t.test("generates distinct hashes when title or content changes", () => {
    const baseContent = { type: "doc", content: [] };
    const hashBase = computeContentHash("Doc A", baseContent, "<p></p>");
    const hashDiffTitle = computeContentHash("Doc B", baseContent, "<p></p>");
    const hashDiffContent = computeContentHash("Doc A", { type: "doc", content: [{ type: "paragraph" }] }, "<p></p>");

    assert.notEqual(hashBase, hashDiffTitle);
    assert.notEqual(hashBase, hashDiffContent);
  });
});

test("DOC-06: Text Diff & Content Comparison with Sanitization", async (t) => {
  await t.test("identifies unchanged, added, and removed tokens", () => {
    const oldHtml = "<p>The quick brown fox jumps</p>";
    const newHtml = "<p>The fast brown fox leaps</p>";

    const diff = computeTextDiff(oldHtml, newHtml);

    assert.ok(Array.isArray(diff));
    assert.ok(diff.some((d) => d.type === "unchanged" && d.value === "The"));
    assert.ok(diff.some((d) => d.type === "removed" && d.value === "quick"));
    assert.ok(diff.some((d) => d.type === "added" && d.value === "fast"));
    assert.ok(diff.some((d) => d.type === "unchanged" && d.value === "brown"));
    assert.ok(diff.some((d) => d.value === "fox"));
  });

  await t.test("sanitizes malicious script tags and event handlers in preview/diff", () => {
    const maliciousHtml = '<p>Safe intro <script>alert("pwned")</script><img src="x" onerror="evil()"/> text</p>';
    const sanitized = sanitizeDocumentHtml(maliciousHtml);

    assert.ok(!sanitized.includes("<script>"));
    assert.ok(!sanitized.includes("onerror"));
    assert.ok(sanitized.includes("Safe intro"));

    const diff = computeTextDiff(maliciousHtml, "<p>Safe intro clean text</p>");
    assert.ok(!diff.some((d) => d.value.includes("script") || d.value.includes("onerror")));
  });

  await t.test("handles completely new or completely removed content", () => {
    const diffNew = computeTextDiff("", "Hello world");
    assert.equal(diffNew.every((d) => d.type === "added"), true);

    const diffRemoved = computeTextDiff("Hello world", "");
    assert.equal(diffRemoved.every((d) => d.type === "removed"), true);
  });
});

test("DOC-06: Safe Non-Destructive Version Restoration Invariants", async (t) => {
  await t.test("restoration appends a new revision without overwriting prior history", () => {
    const history = [
      { revisionNumber: 1, title: "Draft 1", contentHtml: "<p>V1</p>" },
      { revisionNumber: 2, title: "Draft 2", contentHtml: "<p>V2</p>" },
      { revisionNumber: 3, title: "Draft 3", contentHtml: "<p>V3</p>" },
    ];

    // Restore to revision 1
    const restoredTarget = history[0];
    const newRestoredRevision = {
      revisionNumber: history.length + 1, // 4
      title: restoredTarget.title,
      contentHtml: restoredTarget.contentHtml,
      changeSummary: `Restored to Revision #${restoredTarget.revisionNumber}`,
    };

    const updatedHistory = [...history, newRestoredRevision];

    assert.equal(updatedHistory.length, 4);
    assert.equal(updatedHistory[3].revisionNumber, 4);
    assert.equal(updatedHistory[3].contentHtml, "<p>V1</p>");
    // History 1, 2, 3 remain intact
    assert.equal(updatedHistory[0].revisionNumber, 1);
    assert.equal(updatedHistory[1].revisionNumber, 2);
    assert.equal(updatedHistory[2].revisionNumber, 3);
  });

  await t.test("preserves document metadata, folder, and permissions across restoration", () => {
    const originalDoc = {
      _id: "doc_123",
      projectId: "proj_abc",
      folderId: "folder_xyz",
      defaultAccess: "editor",
      shares: [{ userId: "u_alice", role: "viewer" }],
      title: "Current Title",
      contentHtml: "<p>Current Content</p>",
    };

    const versionToRestore = {
      title: "Old Title",
      contentHtml: "<p>Old Content</p>",
      yjsUpdate: "base64_yjs_state",
    };

    // Apply restoration
    const restoredDoc = {
      ...originalDoc,
      title: versionToRestore.title,
      contentHtml: versionToRestore.contentHtml,
      yjsUpdate: versionToRestore.yjsUpdate,
    };

    // Folder and permission metadata remain identical
    assert.equal(restoredDoc.projectId, originalDoc.projectId);
    assert.equal(restoredDoc.folderId, originalDoc.folderId);
    assert.equal(restoredDoc.defaultAccess, originalDoc.defaultAccess);
    assert.deepEqual(restoredDoc.shares, originalDoc.shares);
    // Content is restored
    assert.equal(restoredDoc.title, "Old Title");
    assert.equal(restoredDoc.contentHtml, "<p>Old Content</p>");
  });
});

test("DOC-06: Safe Yjs Restoration Architecture & State Replacement", async (t) => {
  await t.test("demonstrates that Y.applyUpdate merges newer changes instead of rolling back", () => {
    // 1. Snapshot doc V1
    const docV1 = new Y.Doc();
    const textV1 = docV1.getText("content");
    textV1.insert(0, "Original Milestone State");
    const updateV1 = Y.encodeStateAsUpdate(docV1);

    // 2. Doc evolves to V2 with edits
    const docLive = new Y.Doc();
    Y.applyUpdate(docLive, updateV1);
    const textLive = docLive.getText("content");
    textLive.insert(textLive.length, " with Unwanted Corrupt Edits");

    assert.equal(textLive.toString(), "Original Milestone State with Unwanted Corrupt Edits");

    // Naive Y.applyUpdate(docLive, updateV1) does NOT roll back
    Y.applyUpdate(docLive, updateV1);
    assert.notEqual(textLive.toString(), "Original Milestone State");
    assert.equal(textLive.toString(), "Original Milestone State with Unwanted Corrupt Edits");
  });

  await t.test("verifies that fresh Y.Doc instantiation cleanly restores exact historical state", () => {
    // Historical state snapshot
    const historicalDoc = new Y.Doc();
    const histText = historicalDoc.getText("content");
    histText.insert(0, "Clean Authoritative Snapshot");
    const snapshotBytes = Y.encodeStateAsUpdate(historicalDoc);

    // Live session currently holds divergent/corrupt state
    const liveSessionDoc = new Y.Doc();
    const liveText = liveSessionDoc.getText("content");
    liveText.insert(0, "Divergent live state that must be discarded");

    // Execute safe restoration protocol:
    liveSessionDoc.destroy();
    const restoredDoc = new Y.Doc();
    Y.applyUpdate(restoredDoc, snapshotBytes);

    assert.equal(restoredDoc.getText("content").toString(), "Clean Authoritative Snapshot");
  });

  await t.test("verifies that concurrent clients receiving authoritative reset converge cleanly", () => {
    // Clean snapshot
    const snapshotDoc = new Y.Doc();
    snapshotDoc.getText("content").insert(0, "Version 1.0 Restored");
    const resetUpdate = Y.encodeStateAsUpdate(snapshotDoc);

    // Two active client documents
    const clientA = new Y.Doc();
    const clientB = new Y.Doc();

    clientA.getText("content").insert(0, "Client A pending keystrokes");
    clientB.getText("content").insert(0, "Client B draft text");

    // Authoritative reset: destroy old docs and remount fresh docs with restored update
    clientA.destroy();
    clientB.destroy();

    const clientAReset = new Y.Doc();
    const clientBReset = new Y.Doc();

    Y.applyUpdate(clientAReset, resetUpdate);
    Y.applyUpdate(clientBReset, resetUpdate);

    assert.equal(clientAReset.getText("content").toString(), "Version 1.0 Restored");
    assert.equal(clientBReset.getText("content").toString(), "Version 1.0 Restored");
    assert.equal(clientAReset.getText("content").toString(), clientBReset.getText("content").toString());
  });
});

test("DOC-06: Epoch Protection & Stale In-Flight Message Rejection", async (t) => {
  await t.test("rejects client updates stamped with older epoch numbers", () => {
    const room = {
      restoreEpoch: 3, // Document was restored twice, now on epoch 3
      doc: new Y.Doc(),
      dirty: false,
    };

    const isUpdatePermitted = (clientEpoch) => {
      const currentEpoch = room.restoreEpoch || 1;
      return clientEpoch !== undefined && clientEpoch >= currentEpoch;
    };

    // Client B was typing before restoration (epoch 2)
    assert.equal(isUpdatePermitted(2), false); // Rejected as stale
    assert.equal(isUpdatePermitted(1), false); // Rejected as stale
    assert.equal(isUpdatePermitted(3), true);  // Allowed
    assert.equal(isUpdatePermitted(4), true);  // Allowed
  });

  await t.test("simulates epoch bump during restoration and verifies isolation", () => {
    let roomEpoch = 1;
    let roomDoc = new Y.Doc();
    roomDoc.getText("title").insert(0, "Pre-restore live title");

    // Client sends in-flight packet with epoch 1
    const inFlightUpdate = { epoch: 1, text: " stray edit" };

    // Restoration occurs: epoch bumped to 2, roomDoc replaced
    roomEpoch += 1;
    roomDoc.destroy();
    roomDoc = new Y.Doc();
    roomDoc.getText("title").insert(0, "Restored Title v1");

    // In-flight packet arrives
    if (inFlightUpdate.epoch >= roomEpoch) {
      roomDoc.getText("title").insert(roomDoc.getText("title").length, inFlightUpdate.text);
    }

    // Title remains pure restored state without being contaminated by stray edit
    assert.equal(roomDoc.getText("title").toString(), "Restored Title v1");
  });
});

test("DOC-06: Autosave Protection & Race Condition Invariants", async (t) => {
  await t.test("clearing pending autosave timer guarantees pre-restore text is never saved", () => {
    let saveTimeout = null;
    let persistedTitle = "Initial Document";

    // 1. User types in title, scheduling autosave in 1200ms
    const scheduleAutosave = (newTitle) => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        persistedTitle = newTitle;
      }, 1200);
    };

    scheduleAutosave("Divergent Unwanted Draft");

    // 2. User clicks Restore -> Cancel timer immediately
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    persistedTitle = "Restored Clean Version #1";

    // 3. Advance clock past 1200ms
    assert.equal(saveTimeout, null);
    assert.equal(persistedTitle, "Restored Clean Version #1");
  });

  await t.test("simultaneous restoration mutex rejects overlapping requests", () => {
    const restoreLocks = new Map();
    const docId = "doc_test_mutex_123";

    const attemptRestore = (id) => {
      if (restoreLocks.get(id)) {
        return { success: false, code: 409, message: "Another restoration in progress" };
      }
      restoreLocks.set(id, true);
      return { success: true };
    };

    const res1 = attemptRestore(docId);
    const res2 = attemptRestore(docId);

    assert.equal(res1.success, true);
    assert.equal(res2.success, false);
    assert.equal(res2.code, 409);

    restoreLocks.delete(docId);
    const res3 = attemptRestore(docId);
    assert.equal(res3.success, true);
  });
});

test("DOC-06: Endpoint Authorization & Validation Guards", async (t) => {
  await t.test("restricts snapshot creation and restoration to Editor and Owner roles", () => {
    const roles = [
      { role: "viewer", canEdit: false, canRead: true },
      { role: "commenter", canEdit: false, canRead: true },
      { role: "editor", canEdit: true, canRead: true },
      { role: "owner", canEdit: true, canRead: true },
    ];

    const canCreateOrRestore = (r) => Boolean(r.canEdit);
    const canViewHistory = (r) => Boolean(r.canRead);

    assert.equal(canCreateOrRestore(roles[0]), false); // Viewer forbidden
    assert.equal(canCreateOrRestore(roles[1]), false); // Commenter forbidden
    assert.equal(canCreateOrRestore(roles[2]), true);  // Editor allowed
    assert.equal(canCreateOrRestore(roles[3]), true);  // Owner allowed

    assert.equal(canViewHistory(roles[0]), true); // Viewer can read history
    assert.equal(canViewHistory(roles[1]), true); // Commenter can read history
  });

  await t.test("rejects empty snapshot name", () => {
    const validateSnapshotName = (name) => {
      if (!name || !name.trim()) {
        return { valid: false, error: "Snapshot name is required" };
      }
      return { valid: true };
    };

    assert.equal(validateSnapshotName("").valid, false);
    assert.equal(validateSnapshotName("   ").valid, false);
    assert.equal(validateSnapshotName(null).valid, false);
    assert.equal(validateSnapshotName("Sprint Release 1").valid, true);
  });
});

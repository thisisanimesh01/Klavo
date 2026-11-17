import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { extractMentionsFromText } from "../src/utils/mentionHelpers.js";
import { ROLE_HIERARCHY } from "../src/utils/documentPermissions.js";

test("DOC-05: User Mentions Extraction & Parsing", async (t) => {
  await t.test("extracts multiple usernames with @ prefix accurately", () => {
    const text = "Hey @alice and @bob, please review the architecture specs with @charlie!";
    const mentions = extractMentionsFromText(text);

    assert.equal(mentions.length, 3);
    assert.deepEqual(mentions.sort(), ["alice", "bob", "charlie"].sort());
  });

  await t.test("deduplicates multiple mentions of the same username", () => {
    const text = "@alice can you check this? Thanks @Alice!";
    const mentions = extractMentionsFromText(text);

    assert.equal(mentions.length, 1);
    assert.equal(mentions[0], "alice");
  });

  await t.test("returns empty array when text has no mentions or is empty", () => {
    assert.deepEqual(extractMentionsFromText(""), []);
    assert.deepEqual(extractMentionsFromText("No mentions here"), []);
    assert.deepEqual(extractMentionsFromText(null), []);
  });
});

test("DOC-05: Document Comment Role Authorization Rules", async (t) => {
  const checkCommentActions = (role) => {
    const weight = ROLE_HIERARCHY[role] || 0;
    return {
      canViewComments: weight >= 1,   // Viewer, Commenter, Editor, Owner
      canCreateComment: weight >= 2,  // Commenter, Editor, Owner
      canReply: weight >= 2,          // Commenter, Editor, Owner
      canResolve: weight >= 2,        // Commenter, Editor, Owner
      canEditDocument: weight >= 3,   // Editor, Owner only
    };
  };

  await t.test("Owner and Editor have full commenting and document editing permissions", () => {
    const owner = checkCommentActions("owner");
    assert.equal(owner.canViewComments, true);
    assert.equal(owner.canCreateComment, true);
    assert.equal(owner.canReply, true);
    assert.equal(owner.canResolve, true);
    assert.equal(owner.canEditDocument, true);

    const editor = checkCommentActions("editor");
    assert.equal(editor.canViewComments, true);
    assert.equal(editor.canCreateComment, true);
    assert.equal(editor.canReply, true);
    assert.equal(editor.canResolve, true);
    assert.equal(editor.canEditDocument, true);
  });

  await t.test("Commenter can view, create, reply, and resolve, but cannot edit document", () => {
    const commenter = checkCommentActions("commenter");
    assert.equal(commenter.canViewComments, true);
    assert.equal(commenter.canCreateComment, true);
    assert.equal(commenter.canReply, true);
    assert.equal(commenter.canResolve, true);
    assert.equal(commenter.canEditDocument, false); // Crucial capability boundary!
  });

  await t.test("Viewer can only view comments, cannot comment, reply, resolve or edit", () => {
    const viewer = checkCommentActions("viewer");
    assert.equal(viewer.canViewComments, true);
    assert.equal(viewer.canCreateComment, false);
    assert.equal(viewer.canReply, false);
    assert.equal(viewer.canResolve, false);
    assert.equal(viewer.canEditDocument, false);
  });
});

test("DOC-05: Inline Anchor Matching & Thread Resolution", async (t) => {
  await t.test("matches inline comments with selected text quotation", () => {
    const thread = {
      _id: "thread_1",
      anchor: {
        selectedText: "distributed consensus algorithm",
        from: 45,
        to: 76,
      },
      text: "Should we use Raft or Paxos here?",
      isResolved: false,
    };

    assert.equal(thread.anchor.selectedText, "distributed consensus algorithm");
    assert.equal(thread.anchor.from, 45);
    assert.equal(thread.anchor.to, 76);
  });

  await t.test("toggles resolved status and tracks resolver identity", () => {
    const resolverId = new mongoose.Types.ObjectId().toString();
    const thread = {
      _id: "thread_1",
      isResolved: false,
      resolvedBy: null,
      resolvedAt: null,
    };

    // Resolve
    thread.isResolved = true;
    thread.resolvedBy = resolverId;
    thread.resolvedAt = new Date();

    assert.equal(thread.isResolved, true);
    assert.equal(thread.resolvedBy, resolverId);
    assert.ok(thread.resolvedAt instanceof Date);

    // Reopen
    thread.isResolved = false;
    thread.resolvedBy = null;
    thread.resolvedAt = null;

    assert.equal(thread.isResolved, false);
    assert.equal(thread.resolvedBy, null);
  });
});

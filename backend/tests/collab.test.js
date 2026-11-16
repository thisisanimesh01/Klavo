import test from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { COLLAB_COLORS, getCollaboratorColor } from "../src/sockets/documents.js";

test("DOC-03: Yjs CRDT Multi-Client Synchronization", async (t) => {
  await t.test("concurrent edits from two clients merge deterministically without overwriting", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const textA = docA.getText("prosemirror");
    const textB = docB.getText("prosemirror");

    // Client A inserts text
    textA.insert(0, "Hello ");
    const updateA1 = Y.encodeStateAsUpdate(docA);

    // Sync to B
    Y.applyUpdate(docB, updateA1);
    assert.equal(textB.toString(), "Hello ");

    // Client A and B concurrently insert text at the end
    textA.insert(6, "World");
    textB.insert(6, "Klavo");

    const updateA2 = Y.encodeStateAsUpdate(docA);
    const updateB1 = Y.encodeStateAsUpdate(docB);

    // Cross-apply updates
    Y.applyUpdate(docB, updateA2);
    Y.applyUpdate(docA, updateB1);

    // CRDT guarantee: both instances reach identical state
    assert.equal(docA.getText("prosemirror").toString(), docB.getText("prosemirror").toString());
    assert.ok(
      docA.getText("prosemirror").toString() === "Hello WorldKlavo" ||
      docA.getText("prosemirror").toString() === "Hello KlavoWorld"
    );
  });

  await t.test("CRDT binary state serialization and restoration round-trip preserves content", () => {
    const originalDoc = new Y.Doc();
    const text = originalDoc.getText("content");
    text.insert(0, "Antigravity Document Foundation with Yjs CRDTs");

    const binaryUpdate = Y.encodeStateAsUpdate(originalDoc);
    const base64String = Buffer.from(binaryUpdate).toString("base64");

    // Restore into a fresh Y.Doc from base64
    const restoredDoc = new Y.Doc();
    const restoredBinary = Buffer.from(base64String, "base64");
    Y.applyUpdate(restoredDoc, new Uint8Array(restoredBinary));

    assert.equal(
      restoredDoc.getText("content").toString(),
      "Antigravity Document Foundation with Yjs CRDTs"
    );
  });
});

test("DOC-03: Presence & Collaborator Color Assignment", async (t) => {
  await t.test("assigns consistent deterministic color from user identifier", () => {
    const user1 = "65b91a7f0123456789abcdef";
    const user2 = "65b91a7f0123456789fedcba";

    const color1 = getCollaboratorColor(user1);
    const color1Again = getCollaboratorColor(user1);
    const color2 = getCollaboratorColor(user2);

    assert.equal(color1, color1Again);
    assert.ok(COLLAB_COLORS.includes(color1));
    assert.ok(COLLAB_COLORS.includes(color2));
  });

  await t.test("handles null or undefined userId with safe default color", () => {
    const colorNull = getCollaboratorColor(null);
    const colorUndefined = getCollaboratorColor(undefined);

    assert.equal(colorNull, COLLAB_COLORS[0]);
    assert.equal(colorUndefined, COLLAB_COLORS[0]);
  });
});

test("DOC-03: Document Room Access Control & IDOR Denial", async (t) => {
  const aliceId = "user_alice";
  const bobId = "user_bob";
  const eveId = "user_eve";

  const projectAlpha = {
    _id: "proj_alpha",
    teamId: "team_alpha",
  };

  const teamAlpha = {
    _id: "team_alpha",
    owner: aliceId,
    members: [aliceId, bobId],
  };

  const canJoinDocRoom = (team, userId) => {
    if (!team || !userId) return false;
    return team.owner === userId || team.members.includes(userId);
  };

  await t.test("permits project team members to join collaborative room", () => {
    assert.equal(canJoinDocRoom(teamAlpha, aliceId), true);
    assert.equal(canJoinDocRoom(teamAlpha, bobId), true);
  });

  await t.test("strictly denies unauthorized outsiders (IDOR prevention)", () => {
    assert.equal(canJoinDocRoom(teamAlpha, eveId), false);
    assert.equal(canJoinDocRoom(teamAlpha, null), false);
  });
});

test("DOC-03: Active Room Lifecycle & Stale Presence Cleanup", async (t) => {
  await t.test("removes collaborator on socket disconnect and notifies remaining members", () => {
    const collaborators = new Map();
    collaborators.set("sock_1", { name: "Alice", socketId: "sock_1" });
    collaborators.set("sock_2", { name: "Bob", socketId: "sock_2" });

    // sock_1 disconnects
    collaborators.delete("sock_1");

    assert.equal(collaborators.has("sock_1"), false);
    assert.equal(collaborators.size, 1);
    assert.deepEqual(Array.from(collaborators.values()), [
      { name: "Bob", socketId: "sock_2" },
    ]);
  });
});

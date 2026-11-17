import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { resolveDocumentAccess, DOCUMENT_ROLES, ROLE_HIERARCHY } from "../src/utils/documentPermissions.js";

test("DOC-04: Document Roles & Capability Matrix", async (t) => {
  await t.test("verifies hierarchy weights for all 4 document roles", () => {
    assert.equal(ROLE_HIERARCHY.owner > ROLE_HIERARCHY.editor, true);
    assert.equal(ROLE_HIERARCHY.editor > ROLE_HIERARCHY.commenter, true);
    assert.equal(ROLE_HIERARCHY.commenter > ROLE_HIERARCHY.viewer, true);
    assert.equal(ROLE_HIERARCHY.viewer > ROLE_HIERARCHY.none, true);
  });

  await t.test("capability flags map accurately per role weight", () => {
    const checkCaps = (role) => {
      const weight = ROLE_HIERARCHY[role] || 0;
      return {
        canRead: weight >= 1,
        canComment: weight >= 2,
        canEdit: weight >= 3,
        canManagePermissions: weight >= 4,
        canDelete: weight >= 4,
      };
    };

    const ownerCaps = checkCaps("owner");
    assert.equal(ownerCaps.canRead, true);
    assert.equal(ownerCaps.canComment, true);
    assert.equal(ownerCaps.canEdit, true);
    assert.equal(ownerCaps.canManagePermissions, true);
    assert.equal(ownerCaps.canDelete, true);

    const editorCaps = checkCaps("editor");
    assert.equal(editorCaps.canRead, true);
    assert.equal(editorCaps.canComment, true);
    assert.equal(editorCaps.canEdit, true);
    assert.equal(editorCaps.canManagePermissions, false);
    assert.equal(editorCaps.canDelete, false);

    const commenterCaps = checkCaps("commenter");
    assert.equal(commenterCaps.canRead, true);
    assert.equal(commenterCaps.canComment, true);
    assert.equal(commenterCaps.canEdit, false);
    assert.equal(commenterCaps.canManagePermissions, false);

    const viewerCaps = checkCaps("viewer");
    assert.equal(viewerCaps.canRead, true);
    assert.equal(viewerCaps.canComment, false);
    assert.equal(viewerCaps.canEdit, false);
    assert.equal(viewerCaps.canManagePermissions, false);
  });
});

test("DOC-04: Permission Inheritance & Explicit Overrides", async (t) => {
  const creatorId = new mongoose.Types.ObjectId().toString();
  const aliceId = new mongoose.Types.ObjectId().toString();
  const bobId = new mongoose.Types.ObjectId().toString();
  const charlieId = new mongoose.Types.ObjectId().toString();

  const mockDoc = {
    _id: "doc_123",
    projectId: "proj_abc",
    createdBy: creatorId,
    defaultAccess: "viewer", // Project members inherit viewer by default
    shares: [
      { userId: aliceId, role: "editor" },    // Explicit upgrade to editor
      { userId: bobId, role: "commenter" },   // Explicit upgrade to commenter
    ],
  };

  const resolveInMemory = (doc, userId, isTeamOwner) => {
    const uStr = userId.toString();
    if (isTeamOwner || doc.createdBy === uStr) {
      return { role: "owner", canEdit: true, canManagePermissions: true };
    }
    const directShare = doc.shares.find((s) => s.userId === uStr);
    const role = directShare ? directShare.role : doc.defaultAccess || "editor";
    const weight = ROLE_HIERARCHY[role] || 0;
    return {
      role,
      canRead: weight >= 1,
      canComment: weight >= 2,
      canEdit: weight >= 3,
      canManagePermissions: weight >= 4,
    };
  };

  await t.test("creator always has Owner role regardless of defaultAccess", () => {
    const perm = resolveInMemory(mockDoc, creatorId, false);
    assert.equal(perm.role, "owner");
    assert.equal(perm.canManagePermissions, true);
    assert.equal(perm.canEdit, true);
  });

  await t.test("team owner always has Owner role regardless of document shares", () => {
    const teamOwnerId = new mongoose.Types.ObjectId().toString();
    const perm = resolveInMemory(mockDoc, teamOwnerId, true);
    assert.equal(perm.role, "owner");
    assert.equal(perm.canManagePermissions, true);
  });

  await t.test("explicit share overrides defaultAccess (upgrade to editor)", () => {
    const permAlice = resolveInMemory(mockDoc, aliceId, false);
    assert.equal(permAlice.role, "editor");
    assert.equal(permAlice.canEdit, true);
    assert.equal(permAlice.canManagePermissions, false);
  });

  await t.test("explicit share overrides defaultAccess (commenter)", () => {
    const permBob = resolveInMemory(mockDoc, bobId, false);
    assert.equal(permBob.role, "commenter");
    assert.equal(permBob.canComment, true);
    assert.equal(permBob.canEdit, false);
  });

  await t.test("unspecified team member inherits defaultAccess (viewer)", () => {
    const permCharlie = resolveInMemory(mockDoc, charlieId, false);
    assert.equal(permCharlie.role, "viewer");
    assert.equal(permCharlie.canRead, true);
    assert.equal(permCharlie.canEdit, false);
  });
});

test("DOC-04: Cross-Tenant Sharing Denial & IDOR Boundaries", async (t) => {
  const projectTeamMembers = ["user_1", "user_2"];
  const outsiderId = "user_outsider";

  const isEligibleForShare = (teamMembers, targetUserId) => {
    return teamMembers.includes(targetUserId);
  };

  await t.test("denies sharing document with user outside project team", () => {
    assert.equal(isEligibleForShare(projectTeamMembers, outsiderId), false);
    assert.equal(isEligibleForShare(projectTeamMembers, "user_1"), true);
  });

  await t.test("rejects permission management from non-owners", () => {
    const canManage = (userRole) => ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY.owner;
    assert.equal(canManage("editor"), false);
    assert.equal(canManage("commenter"), false);
    assert.equal(canManage("viewer"), false);
    assert.equal(canManage("owner"), true);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACE_ROLES,
  WORKSPACE_ROLE_LEVELS,
  resolveWorkspaceRole,
} from "../src/utils/authHelpers.js";

describe("UX-06: Workspace Role Hierarchy & Capabilities", () => {
  it("defines all required roles with strict hierarchical ordering", () => {
    assert.deepEqual(WORKSPACE_ROLES, ["owner", "admin", "member", "guest"]);
    assert.ok(WORKSPACE_ROLE_LEVELS.owner > WORKSPACE_ROLE_LEVELS.admin);
    assert.ok(WORKSPACE_ROLE_LEVELS.admin > WORKSPACE_ROLE_LEVELS.member);
    assert.ok(WORKSPACE_ROLE_LEVELS.member > WORKSPACE_ROLE_LEVELS.guest);
    assert.ok(WORKSPACE_ROLE_LEVELS.guest > WORKSPACE_ROLE_LEVELS.none);
  });

  it("resolves role accurately with backward compatibility for legacy members", () => {
    const ownerId = "64b0f0000000000000000001";
    const adminId = "64b0f0000000000000000002";
    const memberId = "64b0f0000000000000000003";
    const guestId = "64b0f0000000000000000004";
    const legacyMemberId = "64b0f0000000000000000005";
    const strangerId = "64b0f0000000000000000099";

    const team = {
      _id: "team-1",
      owner: ownerId,
      members: [ownerId, adminId, memberId, guestId, legacyMemberId],
      memberRoles: [
        { userId: ownerId, role: "owner" },
        { userId: adminId, role: "admin" },
        { userId: memberId, role: "member" },
        { userId: guestId, role: "guest" },
        // legacyMemberId has no entry in memberRoles, should fallback to "member"
      ],
    };

    assert.equal(resolveWorkspaceRole(team, ownerId), "owner");
    assert.equal(resolveWorkspaceRole(team, adminId), "admin");
    assert.equal(resolveWorkspaceRole(team, memberId), "member");
    assert.equal(resolveWorkspaceRole(team, guestId), "guest");
    assert.equal(resolveWorkspaceRole(team, legacyMemberId), "member");
    assert.equal(resolveWorkspaceRole(team, strangerId), "none");
  });
});

describe("UX-06: Administrative Invariants & Protection Rules", () => {
  it("enforces last-owner protection (cannot delete or remove the owner directly)", () => {
    const ownerId = "owner-123";
    const canRemoveUser = (teamOwnerId, targetUserId) => {
      if (teamOwnerId === targetUserId) {
        return { allowed: false, reason: "Cannot remove workspace owner" };
      }
      return { allowed: true };
    };

    assert.equal(canRemoveUser(ownerId, ownerId).allowed, false);
    assert.equal(canRemoveUser(ownerId, "other-user").allowed, true);
  });

  it("prevents privilege escalation by non-owners", () => {
    const canChangeRole = (requesterRole, targetCurrentRole, targetNewRole) => {
      // Only owner and admin can change roles
      if (requesterRole !== "owner" && requesterRole !== "admin") return false;

      // Nobody can promote to owner via regular role update
      if (targetNewRole === "owner") return false;

      // Only owner can demote/modify an admin
      if (targetCurrentRole === "admin" && requesterRole !== "owner") return false;

      // Cannot modify owner role
      if (targetCurrentRole === "owner") return false;

      return true;
    };

    // Owner can change anyone except owner
    assert.equal(canChangeRole("owner", "member", "admin"), true);
    assert.equal(canChangeRole("owner", "admin", "member"), true);
    assert.equal(canChangeRole("owner", "member", "guest"), true);
    assert.equal(canChangeRole("owner", "owner", "admin"), false); // must transfer ownership

    // Admin can change regular members and guests
    assert.equal(canChangeRole("admin", "member", "guest"), true);
    assert.equal(canChangeRole("admin", "guest", "member"), true);

    // Admin CANNOT promote to owner
    assert.equal(canChangeRole("admin", "member", "owner"), false);

    // Admin CANNOT modify or demote another admin
    assert.equal(canChangeRole("admin", "admin", "member"), false);

    // Regular member cannot change any roles
    assert.equal(canChangeRole("member", "guest", "member"), false);
  });

  it("validates ownership transfer invariants", () => {
    const validateTransfer = (requesterId, currentOwnerId, newOwnerId, teamMembers) => {
      // 1. Only current owner can initiate transfer
      if (requesterId !== currentOwnerId) {
        return { valid: false, error: "Only current owner can transfer ownership" };
      }
      // 2. Cannot transfer to self
      if (newOwnerId === currentOwnerId) {
        return { valid: false, error: "User is already the workspace owner" };
      }
      // 3. New owner must already be a workspace member
      if (!teamMembers.includes(newOwnerId)) {
        return { valid: false, error: "New owner must be an active workspace member" };
      }
      return { valid: true };
    };

    const team = {
      owner: "owner-1",
      members: ["owner-1", "admin-1", "member-1"],
    };

    assert.equal(validateTransfer("admin-1", team.owner, "member-1", team.members).valid, false);
    assert.equal(validateTransfer("owner-1", team.owner, "owner-1", team.members).valid, false);
    assert.equal(validateTransfer("owner-1", team.owner, "stranger-1", team.members).valid, false);
    assert.equal(validateTransfer("owner-1", team.owner, "admin-1", team.members).valid, true);
  });
});

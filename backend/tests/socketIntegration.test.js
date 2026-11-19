import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

describe("REL-01: Socket.IO Authentication & Real-Time Event Integration", () => {
  const JWT_SECRET = "test_jwt_secret_key_ci";

  const mockUsers = {
    alice: { _id: "usr_alice_001", name: "Alice Owner" },
    bob: { _id: "usr_bob_002", name: "Bob Member" },
    eve: { _id: "usr_eve_003", name: "Eve Outsider" },
  };

  const mockTeams = {
    teamAlpha: {
      _id: "team_101",
      name: "Engineering Team",
      owner: mockUsers.alice._id,
      members: [mockUsers.alice._id, mockUsers.bob._id],
    },
  };

  const mockProjects = {
    projAlpha: {
      _id: "proj_201",
      name: "Core Platform",
      teamId: mockTeams.teamAlpha._id,
    },
  };

  /**
   * Simulates the Socket.IO authentication middleware from index.js
   */
  const authenticateSocket = (handshake) => {
    try {
      const token =
        handshake.auth?.token ||
        handshake.headers?.authorization?.split(" ")[1] ||
        handshake.query?.token;

      if (!token) {
        return { user: null, authenticated: false };
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = Object.values(mockUsers).find((u) => u._id === decoded.id);
      if (!user) {
        return { user: null, authenticated: false, error: "User not found" };
      }

      return { user, authenticated: true };
    } catch (err) {
      return { user: null, authenticated: false, error: err.message };
    }
  };

  /**
   * Simulates room join authorization logic for team, project, and user rooms
   */
  const authorizeRoomJoin = (user, roomName) => {
    if (!user) {
      return { allowed: false, reason: "Unauthenticated socket" };
    }

    if (roomName.startsWith("user_")) {
      const targetUserId = roomName.replace("user_", "");
      const allowed = user._id === targetUserId;
      return { allowed, reason: allowed ? null : "Cannot join another user's private notification channel" };
    }

    if (roomName.startsWith("team_")) {
      const targetTeamId = roomName.replace("team_", "");
      const team = Object.values(mockTeams).find((t) => t._id === targetTeamId);
      const allowed = Boolean(team && (team.owner === user._id || team.members.includes(user._id)));
      return { allowed, reason: allowed ? null : "Unauthorized: You are not a member of this team" };
    }

    if (roomName.startsWith("project_")) {
      const targetProjectId = roomName.replace("project_", "");
      const project = Object.values(mockProjects).find((p) => p._id === targetProjectId);
      if (!project) return { allowed: false, reason: "Project not found" };

      const team = Object.values(mockTeams).find((t) => t._id === project.teamId);
      const allowed = Boolean(team && (team.owner === user._id || team.members.includes(user._id)));
      return { allowed, reason: allowed ? null : "Unauthorized: You do not have access to this project" };
    }

    return { allowed: false, reason: "Unsupported room prefix" };
  };

  it("authenticates socket connections via auth payload token", () => {
    const validToken = jwt.sign({ id: mockUsers.alice._id }, JWT_SECRET);
    const { user, authenticated } = authenticateSocket({ auth: { token: validToken } });
    assert.equal(authenticated, true);
    assert.equal(user.name, "Alice Owner");
  });

  it("authenticates socket connections via authorization header Bearer token", () => {
    const validToken = jwt.sign({ id: mockUsers.bob._id }, JWT_SECRET);
    const { user, authenticated } = authenticateSocket({
      headers: { authorization: `Bearer ${validToken}` },
    });
    assert.equal(authenticated, true);
    assert.equal(user.name, "Bob Member");
  });

  it("handles unauthenticated or expired socket handshakes gracefully", () => {
    // Missing token
    const emptyResult = authenticateSocket({});
    assert.equal(emptyResult.authenticated, false);
    assert.equal(emptyResult.user, null);

    // Malformed token
    const badResult = authenticateSocket({ auth: { token: "invalid.token.payload" } });
    assert.equal(badResult.authenticated, false);
    assert.ok(badResult.error);
  });

  it("enforces private user channel isolation", () => {
    // Alice joining her own room
    const aliceSelf = authorizeRoomJoin(mockUsers.alice, `user_${mockUsers.alice._id}`);
    assert.equal(aliceSelf.allowed, true);

    // Eve attempting to snoop on Alice's room
    const eveIntrusion = authorizeRoomJoin(mockUsers.eve, `user_${mockUsers.alice._id}`);
    assert.equal(eveIntrusion.allowed, false);
    assert.equal(eveIntrusion.reason, "Cannot join another user's private notification channel");
  });

  it("enforces team room authorization and denies non-members", () => {
    const teamId = mockTeams.teamAlpha._id;

    // Bob (member) allowed
    const bobAccess = authorizeRoomJoin(mockUsers.bob, `team_${teamId}`);
    assert.equal(bobAccess.allowed, true);

    // Eve (outsider) denied
    const eveAccess = authorizeRoomJoin(mockUsers.eve, `team_${teamId}`);
    assert.equal(eveAccess.allowed, false);
    assert.ok(eveAccess.reason.includes("Unauthorized"));
  });

  it("enforces project room authorization and denies outsiders", () => {
    const projectId = mockProjects.projAlpha._id;

    // Alice (team owner) allowed
    const aliceAccess = authorizeRoomJoin(mockUsers.alice, `project_${projectId}`);
    assert.equal(aliceAccess.allowed, true);

    // Eve (outsider) denied
    const eveAccess = authorizeRoomJoin(mockUsers.eve, `project_${projectId}`);
    assert.equal(eveAccess.allowed, false);
  });
});

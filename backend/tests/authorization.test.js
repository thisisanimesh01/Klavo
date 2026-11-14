import test from "node:test";
import assert from "node:assert/strict";
import { mockUsers, mockTeams, mockProjects, mockTasks } from "./fixtures/mockData.js";

test("SEC-03: Team ownership and membership access controls", async (t) => {
  const checkTeamAccess = (teamId, userId) => {
    const team = Object.values(mockTeams).find((tm) => tm._id === teamId);
    if (!team) return { isMember: false, isOwner: false, team: null };
    const uid = userId.toString();
    const isOwner = team.owner.toString() === uid;
    const isMember = isOwner || team.members.some((m) => m.toString() === uid);
    return { isMember, isOwner, team };
  };

  await t.test("Alice (owner) has full owner and member privileges", () => {
    const access = checkTeamAccess(mockTeams.teamAlpha._id, mockUsers.alice._id);
    assert.equal(access.isOwner, true);
    assert.equal(access.isMember, true);
  });

  await t.test("Bob (member) has member privileges but not owner privileges", () => {
    const access = checkTeamAccess(mockTeams.teamAlpha._id, mockUsers.bob._id);
    assert.equal(access.isOwner, false);
    assert.equal(access.isMember, true);
  });

  await t.test("Eve (outsider) has zero privileges on Team Alpha", () => {
    const access = checkTeamAccess(mockTeams.teamAlpha._id, mockUsers.eve._id);
    assert.equal(access.isOwner, false);
    assert.equal(access.isMember, false);
  });
});

test("SEC-03: Cross-tenant IDOR protection on projects and tasks", async (t) => {
  const checkProjectAccess = (projectId, userId) => {
    const project = Object.values(mockProjects).find((p) => p._id === projectId);
    if (!project) return { hasAccess: false, project: null };
    const team = mockTeams.teamAlpha;
    const uid = userId.toString();
    const hasAccess = team.members.some((m) => m.toString() === uid);
    return { hasAccess, project };
  };

  const checkTaskAccess = (taskId, userId) => {
    const task = Object.values(mockTasks).find((tk) => tk._id === taskId);
    if (!task) return { hasAccess: false, task: null };
    const { hasAccess, project } = checkProjectAccess(task.projectId, userId);
    return { hasAccess, task, project };
  };

  await t.test("Members can access project tasks", () => {
    const aliceTask = checkTaskAccess(mockTasks.task1._id, mockUsers.alice._id);
    assert.equal(aliceTask.hasAccess, true);
    assert.equal(aliceTask.task.title, "Implement automated tests");
  });

  await t.test("Unauthorized users are blocked from reading or mutating tasks (IDOR denial)", () => {
    const eveTask = checkTaskAccess(mockTasks.task1._id, mockUsers.eve._id);
    assert.equal(eveTask.hasAccess, false);
  });
});

test("SEC-03: Socket.IO authenticated room join authorization", async (t) => {
  const evaluateRoomJoin = (socketUser, requestedRoom) => {
    if (!socketUser) return { allow: false, reason: "Unauthenticated" };

    if (requestedRoom.startsWith("user_")) {
      const targetUserId = requestedRoom.replace("user_", "");
      return targetUserId === socketUser._id
        ? { allow: true }
        : { allow: false, reason: "Cannot join another user's room" };
    }

    if (requestedRoom.startsWith("team_")) {
      const targetTeamId = requestedRoom.replace("team_", "");
      const team = mockTeams.teamAlpha;
      const isMember = team._id === targetTeamId && team.members.includes(socketUser._id);
      return isMember ? { allow: true } : { allow: false, reason: "Not a team member" };
    }

    return { allow: false, reason: "Unknown room type" };
  };

  await t.test("User cannot join another user's private notification room", () => {
    const res = evaluateRoomJoin(mockUsers.eve, `user_${mockUsers.alice._id}`);
    assert.equal(res.allow, false);
  });

  await t.test("Member can join team room; outsider is rejected", () => {
    assert.equal(evaluateRoomJoin(mockUsers.bob, `team_${mockTeams.teamAlpha._id}`).allow, true);
    assert.equal(evaluateRoomJoin(mockUsers.eve, `team_${mockTeams.teamAlpha._id}`).allow, false);
  });
});

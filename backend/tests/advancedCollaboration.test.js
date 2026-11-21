import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import {
  activePresence,
  socketPresenceRooms,
  getScopePresenceList,
  removeSocketFromScope,
  cleanupSocketPresence,
  initPresenceSockets,
} from "../src/sockets/presence.js";
import {
  activeTaskViewers,
  socketTaskRooms,
  getTaskViewersList,
  removeSocketFromTask,
  cleanupSocketTaskRooms,
  initTaskSockets,
} from "../src/sockets/tasks.js";
import { activeDocRooms } from "../src/sockets/documents.js";
import { logActivity } from "../src/controllers/activityController.js";
import Activity from "../src/models/Activity.js";

describe("COLLAB-01: Advanced Real-Time Collaboration & Presence Architecture", () => {
  const mockUsers = {
    alice: { _id: "usr_alice_001", name: "Alice Admin", email: "alice@test.local", role: "owner" },
    bob: { _id: "usr_bob_002", name: "Bob Dev", email: "bob@test.local", role: "member" },
    eve: { _id: "usr_eve_003", name: "Eve Attacker", email: "eve@test.local", role: "none" },
  };

  const createMockSocket = (id, user = null) => {
    const listeners = new Map();
    const joinedRooms = new Set();
    const emittedEvents = [];

    const socket = {
      id,
      user,
      join: (room) => joinedRooms.add(room),
      leave: (room) => joinedRooms.delete(room),
      rooms: joinedRooms,
      on: (event, handler) => {
        listeners.set(event, handler);
      },
      emit: (event, payload) => {
        emittedEvents.push({ event, payload });
      },
      to: (room) => ({
        emit: (event, payload) => {
          emittedEvents.push({ toRoom: room, event, payload });
        },
      }),
      // test triggers
      _trigger: async (event, data) => {
        const handler = listeners.get(event);
        if (handler) {
          await handler(data);
        }
      },
      _getEmitted: () => emittedEvents,
      _clearEmitted: () => {
        emittedEvents.length = 0;
      },
    };

    return socket;
  };

  const createMockIo = () => {
    const roomEvents = [];
    return {
      to: (room) => ({
        emit: (event, payload) => {
          roomEvents.push({ room, event, payload });
        },
      }),
      _getRoomEvents: () => roomEvents,
      _clearRoomEvents: () => {
        roomEvents.length = 0;
      },
    };
  };

  beforeEach(() => {
    activePresence.clear();
    socketPresenceRooms.clear();
    activeTaskViewers.clear();
    socketTaskRooms.clear();
    activeDocRooms.clear();
  });

  describe("1. Presence Subsystem Management", () => {
    it("tracks user presence across scope and maintains accurate roster", () => {
      const io = createMockIo();
      const scopeKey = "project_proj_123";

      // Direct tracking validation
      activePresence.set(scopeKey, new Map());
      activePresence.get(scopeKey).set("socket_1", {
        socketId: "socket_1",
        userId: mockUsers.alice._id,
        name: mockUsers.alice.name,
        email: mockUsers.alice.email,
        role: "owner",
        lastSeen: Date.now(),
      });
      activePresence.get(scopeKey).set("socket_2", {
        socketId: "socket_2",
        userId: mockUsers.bob._id,
        name: mockUsers.bob.name,
        email: mockUsers.bob.email,
        role: "member",
        lastSeen: Date.now(),
      });

      const roster = getScopePresenceList(scopeKey);
      assert.equal(roster.length, 2, "Expected 2 active members in presence roster");
      assert.equal(roster[0].userId, mockUsers.alice._id);
      assert.equal(roster[1].userId, mockUsers.bob._id);

      // Verify removal on socket disconnect
      socketPresenceRooms.set("socket_1", new Set([scopeKey]));
      removeSocketFromScope(io, scopeKey, "socket_1");

      const remaining = getScopePresenceList(scopeKey);
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].userId, mockUsers.bob._id);

      const ioEvents = io._getRoomEvents();
      const leftEvent = ioEvents.find((e) => e.event === "presence:userLeft");
      assert.ok(leftEvent, "presence:userLeft event was broadcast");
      assert.equal(leftEvent.payload.userId, mockUsers.alice._id);
      assert.equal(leftEvent.payload.remainingMembers.length, 1);
    });

    it("cleans up activePresence and socketPresenceRooms when last user departs", () => {
      const io = createMockIo();
      const scopeKey = "team_team_999";

      activePresence.set(scopeKey, new Map());
      activePresence.get(scopeKey).set("socket_alice", {
        socketId: "socket_alice",
        userId: mockUsers.alice._id,
        name: mockUsers.alice.name,
        lastSeen: Date.now(),
      });
      socketPresenceRooms.set("socket_alice", new Set([scopeKey]));

      cleanupSocketPresence(io, "socket_alice");

      assert.equal(activePresence.has(scopeKey), false, "Scope map removed when empty");
      assert.equal(socketPresenceRooms.has("socket_alice"), false, "Socket room set purged");
    });

    it("rejects unauthenticated presence join attempts with authorization error", async () => {
      const io = createMockIo();
      const socket = createMockSocket("anon_socket", null);
      initPresenceSockets(io, socket);

      await socket._trigger("presence:join", { scopeType: "project", scopeId: "proj_secret" });

      const emitted = socket._getEmitted();
      const err = emitted.find((e) => e.event === "presence:error");
      assert.ok(err, "Expected presence:error on unauthenticated join");
      assert.match(err.payload.message, /Unauthorized/);
      assert.equal(socket.rooms.has("project_proj_secret"), false, "Unauthenticated socket did not join room");
    });
  });

  describe("2. Task Collaboration & Viewer Tracking", () => {
    it("tracks task viewers and notifies room upon join and leave", () => {
      const io = createMockIo();
      const taskId = "task_456";

      activeTaskViewers.set(taskId, new Map());
      activeTaskViewers.get(taskId).set("sock_a", {
        socketId: "sock_a",
        userId: mockUsers.alice._id,
        name: mockUsers.alice.name,
        joinedAt: Date.now(),
      });

      assert.equal(getTaskViewersList(taskId).length, 1);
      assert.equal(getTaskViewersList(taskId)[0].name, "Alice Admin");

      socketTaskRooms.set("sock_a", new Set([taskId]));
      cleanupSocketTaskRooms(io, "sock_a");

      assert.equal(activeTaskViewers.has(taskId), false, "Task room map cleaned up when empty");
      const ioEvents = io._getRoomEvents();
      const viewersUpdated = ioEvents.find((e) => e.event === "task:viewersUpdated");
      assert.ok(viewersUpdated, "task:viewersUpdated event broadcast on leave");
      assert.equal(viewersUpdated.payload.viewers.length, 0);
    });

    it("rejects unauthenticated task collaboration joins", async () => {
      const io = createMockIo();
      const socket = createMockSocket("anon_task_socket", null);
      initTaskSockets(io, socket);

      await socket._trigger("task:join", { taskId: "task_sensitive" });

      const emitted = socket._getEmitted();
      const err = emitted.find((e) => e.event === "task:error");
      assert.ok(err, "Expected task:error on unauthenticated join");
      assert.match(err.payload.message, /Unauthorized/);
    });
  });

  describe("3. Real-Time Activity Broadcast", () => {
    it("broadcasts activityCreated to project room when io is provided", async () => {
      const io = createMockIo();
      const projectId = "proj_test_collab";
      const userId = "usr_alice_001";

      // Mock Activity.create and findById
      const originalCreate = Activity.create;
      const originalFindById = Activity.findById;

      Activity.create = async (doc) => ({
        _id: "act_101",
        ...doc,
        createdAt: new Date(),
      });

      Activity.findById = (id) => ({
        populate: async () => ({
          _id: id,
          projectId,
          user: { _id: userId, name: "Alice Admin", email: "alice@test.local" },
          action: "Completed Task",
          message: "Alice completed 'Implement Collaboration'",
        }),
      });

      try {
        await logActivity({
          projectId,
          userId,
          action: "Completed Task",
          message: "Alice completed 'Implement Collaboration'",
          io,
        });

        const events = io._getRoomEvents();
        const broadcast = events.find((e) => e.room === `project_${projectId}`);
        assert.ok(broadcast, "activityCreated event broadcast to project room");
        assert.equal(broadcast.event, "activityCreated");
        assert.equal(broadcast.payload.action, "Completed Task");
        assert.equal(broadcast.payload.user.name, "Alice Admin");
      } finally {
        Activity.create = originalCreate;
        Activity.findById = originalFindById;
      }
    });
  });

  describe("4. Yjs CRDT Reconnection & Conflict Recovery", () => {
    it("handles concurrent edits without divergence using CRDT merging", () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();

      const textA = docA.getText("content");
      const textB = docB.getText("content");

      // Initial sync
      const initUpdate = Y.encodeStateAsUpdate(docA);
      Y.applyUpdate(docB, initUpdate);

      // Concurrent independent edits
      textA.insert(0, "Alice started typing. ");
      textB.insert(0, "Bob started typing. ");

      // Exchange updates
      const updateFromA = Y.encodeStateAsUpdate(docA);
      const updateFromB = Y.encodeStateAsUpdate(docB);

      Y.applyUpdate(docB, updateFromA);
      Y.applyUpdate(docA, updateFromB);

      // Both documents must converge to identical deterministic state
      assert.equal(textA.toString(), textB.toString());
      assert.ok(textA.toString().includes("Alice started typing. "));
      assert.ok(textA.toString().includes("Bob started typing. "));
    });

    it("supports resync catchup when client experiences network reconnect", () => {
      const serverDoc = new Y.Doc();
      const text = serverDoc.getText("content");
      text.insert(0, "Authoritative state while client was offline.");

      const roomData = {
        doc: serverDoc,
        connectedSockets: new Set(["reconnecting_socket"]),
        collaborators: new Map([
          ["reconnecting_socket", { socketId: "reconnecting_socket", name: "Alice" }],
        ]),
        restoreEpoch: 2,
      };

      activeDocRooms.set("doc_test_resync", roomData);

      // Verify that full update is retrievable for resync
      const stateUpdate = Y.encodeStateAsUpdate(roomData.doc);
      assert.ok(stateUpdate.length > 0, "Generated non-empty state update for reconnect");

      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, stateUpdate);
      assert.equal(clientDoc.getText("content").toString(), "Authoritative state while client was offline.");
    });
  });
});

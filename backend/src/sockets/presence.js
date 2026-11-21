import { checkTeamAccess, checkProjectAccess, checkTaskAccess } from "../utils/authHelpers.js";

/**
 * Global presence tracker for active teams, projects, and task viewing rooms.
 * Map<scopeKey, Map<socketId, { socketId, userId, name, email, avatar, role, lastSeen }>>
 * Scope keys:
 *   - team_${teamId}
 *   - project_${projectId}
 *   - task_${taskId}
 */
export const activePresence = new Map();

/**
 * Maps socket.id -> Set<scopeKey> for cleanup on disconnect.
 */
export const socketPresenceRooms = new Map();

/**
 * Returns formatted array of active collaborators in a scope.
 */
export const getScopePresenceList = (scopeKey) => {
  const membersMap = activePresence.get(scopeKey);
  if (!membersMap) return [];
  return Array.from(membersMap.values());
};

/**
 * Removes socket from a specific scope room and broadcasts updated presence.
 */
export const removeSocketFromScope = (io, scopeKey, socketId) => {
  const membersMap = activePresence.get(scopeKey);
  if (!membersMap) return;

  if (membersMap.has(socketId)) {
    const member = membersMap.get(socketId);
    membersMap.delete(socketId);

    // If scope has no more members, free map
    if (membersMap.size === 0) {
      activePresence.delete(scopeKey);
    }

    io.to(scopeKey).emit("presence:userLeft", {
      scopeKey,
      socketId,
      userId: member.userId,
      remainingMembers: getScopePresenceList(scopeKey),
    });
  }

  const roomSet = socketPresenceRooms.get(socketId);
  if (roomSet) {
    roomSet.delete(scopeKey);
    if (roomSet.size === 0) {
      socketPresenceRooms.delete(socketId);
    }
  }
};

/**
 * Cleans up all presence scopes associated with a disconnecting socket.
 */
export const cleanupSocketPresence = (io, socketId) => {
  const roomSet = socketPresenceRooms.get(socketId);
  if (!roomSet) return;

  for (const scopeKey of Array.from(roomSet)) {
    removeSocketFromScope(io, scopeKey, socketId);
  }
  socketPresenceRooms.delete(socketId);
};

/**
 * Initializes real-time presence Socket.IO listeners.
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export const initPresenceSockets = (io, socket) => {
  // Join presence room with strict RBAC authorization
  socket.on("presence:join", async ({ scopeType, scopeId }) => {
    if (!scopeType || !scopeId) return;

    if (!socket.user) {
      socket.emit("presence:error", {
        message: "Unauthorized: Authentication required to join presence room",
        scopeType,
        scopeId,
      });
      return;
    }

    let hasAccess = false;
    let resolvedRole = "member";

    try {
      if (scopeType === "team") {
        const teamAccess = await checkTeamAccess(scopeId, socket.user._id);
        hasAccess = teamAccess.isMember;
        resolvedRole = teamAccess.role || "member";
      } else if (scopeType === "project") {
        const projectAccess = await checkProjectAccess(scopeId, socket.user._id);
        hasAccess = projectAccess.hasAccess;
        resolvedRole = projectAccess.role || "member";
      } else if (scopeType === "task") {
        const taskAccess = await checkTaskAccess(scopeId, socket.user._id);
        hasAccess = taskAccess.hasAccess;
        resolvedRole = "member";
      } else {
        socket.emit("presence:error", {
          message: `Invalid scopeType: ${scopeType}`,
          scopeType,
          scopeId,
        });
        return;
      }
    } catch (err) {
      socket.emit("presence:error", {
        message: err.message || "Failed to verify presence room permissions",
        scopeType,
        scopeId,
      });
      return;
    }

    if (!hasAccess) {
      socket.emit("presence:error", {
        message: "Unauthorized: You do not have access to this resource",
        scopeType,
        scopeId,
      });
      return;
    }

    const scopeKey = `${scopeType}_${scopeId}`;
    socket.join(scopeKey);

    if (!activePresence.has(scopeKey)) {
      activePresence.set(scopeKey, new Map());
    }

    const memberData = {
      socketId: socket.id,
      userId: socket.user._id.toString(),
      name: socket.user.name || "Anonymous",
      email: socket.user.email || "",
      avatar: socket.user.avatar || null,
      role: resolvedRole,
      lastSeen: Date.now(),
    };

    activePresence.get(scopeKey).set(socket.id, memberData);

    if (!socketPresenceRooms.has(socket.id)) {
      socketPresenceRooms.set(socket.id, new Set());
    }
    socketPresenceRooms.get(socket.id).add(scopeKey);

    // Send immediate snapshot of current presence to newly joined client
    socket.emit("presence:sync", {
      scopeKey,
      scopeType,
      scopeId,
      members: getScopePresenceList(scopeKey),
    });

    // Broadcast new user to other room members
    socket.to(scopeKey).emit("presence:userJoined", {
      scopeKey,
      scopeType,
      scopeId,
      member: memberData,
    });
  });

  // Client leaves presence room explicitly
  socket.on("presence:leave", ({ scopeType, scopeId }) => {
    if (!scopeType || !scopeId) return;
    const scopeKey = `${scopeType}_${scopeId}`;
    socket.leave(scopeKey);
    removeSocketFromScope(io, scopeKey, socket.id);
  });

  // Client sends periodic heartbeat to keep presence fresh
  socket.on("presence:heartbeat", ({ scopeType, scopeId }) => {
    if (!scopeType || !scopeId) return;
    const scopeKey = `${scopeType}_${scopeId}`;
    const membersMap = activePresence.get(scopeKey);
    if (membersMap && membersMap.has(socket.id)) {
      membersMap.get(socket.id).lastSeen = Date.now();
    }
  });

  // Query presence snapshot on demand
  socket.on("presence:query", ({ scopeType, scopeId }) => {
    if (!scopeType || !scopeId) return;
    const scopeKey = `${scopeType}_${scopeId}`;
    socket.emit("presence:sync", {
      scopeKey,
      scopeType,
      scopeId,
      members: getScopePresenceList(scopeKey),
    });
  });

  // Automatically handle socket disconnection
  socket.on("disconnect", () => {
    cleanupSocketPresence(io, socket.id);
  });
};

import * as Y from "yjs";
import Document from "../models/Document.js";
import { checkProjectAccess } from "../utils/authHelpers.js";
import { resolveDocumentAccess } from "../utils/documentPermissions.js";
import { redisCoordinator } from "../utils/redisCoordinator.js";

// Active document room state in memory:
// Map<documentId, {
//   doc: Y.Doc,
//   projectId: string,
//   teamId: string,
//   connectedSockets: Set<string>, // socket.id
//   collaborators: Map<string, { socketId, userId, name, email, avatar, color, role, canEdit, cursor, selection, lastActive }>,
//   debounceTimer: NodeJS.Timeout | null,
//   dirty: boolean,
//   restoreEpoch: number, // Epoch/generation counter to reject pre-restore in-flight updates
// }>
export const activeDocRooms = new Map();

// Global pub/sub sync listener for cross-pod document editing
if (redisCoordinator && typeof redisCoordinator.on === "function") {
  redisCoordinator.on("docSyncUpdate", ({ documentId, update, epoch, senderSocketId }) => {
    const room = activeDocRooms.get(documentId);
    if (!room) return;
    try {
      const updateBuffer = Buffer.from(update, "base64");
      Y.applyUpdate(room.doc, new Uint8Array(updateBuffer));
      room.dirty = true;
    } catch (e) {
      // Ignored
    }
  });
}

// Color palette for collaborator cursors and avatars
export const COLLAB_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#10b981", // emerald
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#e11d48", // rose
];

/**
 * Assigns a deterministic or cycling color based on userId or socketId string.
 */
export const getCollaboratorColor = (userIdStr) => {
  if (!userIdStr) return COLLAB_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userIdStr.length; i++) {
    hash = (hash << 5) - hash + userIdStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLLAB_COLORS.length;
  return COLLAB_COLORS[index];
};

/**
 * Flushes Y.Doc state to MongoDB if dirty.
 */
export const persistDocumentState = async (documentId) => {
  const room = activeDocRooms.get(documentId);
  if (!room || !room.dirty) return;

  try {
    const updateBytes = Y.encodeStateAsUpdate(room.doc);
    const yjsUpdateBase64 = Buffer.from(updateBytes).toString("base64");

    await Document.findByIdAndUpdate(documentId, {
      yjsUpdate: yjsUpdateBase64,
    });
    room.dirty = false;
  } catch (err) {
    console.error(`Failed to persist document ${documentId} Yjs state:`, err);
  }
};

/**
 * Initializes real-time collaborative document Socket.IO event listeners.
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export const initDocumentSockets = (io, socket) => {
  // Join a document collaborative editing room with granular permissions check
  socket.on("joinDocumentCollab", async ({ documentId }) => {
    if (!documentId) return;

    try {
      const doc = await Document.findById(documentId);
      if (!doc) {
        socket.emit("collabError", { message: "Document not found" });
        return;
      }

      // Check granular document-level permission (Owner, Editor, Commenter, Viewer)
      let perm = {
        hasAccess: true,
        role: "editor",
        canRead: true,
        canComment: true,
        canEdit: true,
        canManagePermissions: false,
        canDelete: false,
      };

      if (socket.user) {
        perm = await resolveDocumentAccess(doc, socket.user._id);
        if (!perm.canRead) {
          socket.emit("collabError", {
            message: "Unauthorized: You do not have permission to access this document",
          });
          return;
        }
      }

      const roomKey = `doc_collab_${documentId}`;
      socket.join(roomKey);

      // Initialize or retrieve active room
      let room = activeDocRooms.get(documentId);
      if (!room) {
        const ydoc = new Y.Doc();

        // Restore Yjs update from DB if available
        if (doc.yjsUpdate) {
          try {
            const binaryUpdate = Buffer.from(doc.yjsUpdate, "base64");
            Y.applyUpdate(ydoc, new Uint8Array(binaryUpdate));
          } catch (restoreErr) {
            console.error("Failed to restore Yjs binary state:", restoreErr);
          }
        }

        room = {
          doc: ydoc,
          projectId: doc.projectId.toString(),
          teamId: doc.teamId.toString(),
          connectedSockets: new Set(),
          collaborators: new Map(),
          debounceTimer: null,
          dirty: false,
          restoreEpoch: 1,
        };
        activeDocRooms.set(documentId, room);
      }

      room.connectedSockets.add(socket.id);

      // Identity resolution
      const userId = socket.user ? socket.user._id.toString() : `anon_${socket.id.slice(0, 6)}`;
      const userName = socket.user ? socket.user.name : "Anonymous";
      const userEmail = socket.user ? socket.user.email : "";
      const userAvatar = socket.user ? socket.user.avatar : null;
      const userColor = getCollaboratorColor(userId);

      const collaborator = {
        socketId: socket.id,
        userId,
        name: userName,
        email: userEmail,
        avatar: userAvatar,
        color: userColor,
        role: perm.role,
        canEdit: perm.canEdit,
        cursor: null,
        selection: null,
        lastActive: Date.now(),
      };

      room.collaborators.set(socket.id, collaborator);

      // Send initial synchronized document state, authoritative restoreEpoch, and user's resolved role
      const initialUpdate = Y.encodeStateAsUpdate(room.doc);
      socket.emit("docSyncInit", {
        documentId,
        update: Buffer.from(initialUpdate).toString("base64"),
        epoch: room.restoreEpoch || 1,
        collaborators: Array.from(room.collaborators.values()),
        currentUserColor: userColor,
        userPermission: perm,
      });

      // Broadcast new collaborator presence to others in the room
      socket.to(roomKey).emit("collabUserJoined", collaborator);
    } catch (err) {
      console.error("Error in joinDocumentCollab:", err);
      socket.emit("collabError", { message: err.message });
    }
  });

  // Client sent incremental Yjs CRDT update (strictly enforced: canEdit must be true, epoch must match)
  socket.on("docSyncUpdate", async ({ documentId, update, epoch }) => {
    if (!documentId || !update) return;

    const room = activeDocRooms.get(documentId);
    if (!room || !room.connectedSockets.has(socket.id)) return;

    // EPOCH PROTECTION GATE: Reject stale in-flight updates generated before an authoritative restoration
    const currentRoomEpoch = room.restoreEpoch || 1;
    if (epoch !== undefined && epoch !== null && epoch < currentRoomEpoch) {
      // Discard stale pre-restore update and instruct client to align with current epoch
      socket.emit("docSyncInit", {
        documentId,
        update: Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString("base64"),
        epoch: currentRoomEpoch,
        collaborators: Array.from(room.collaborators.values()),
      });
      return;
    }

    const collaborator = room.collaborators.get(socket.id);
    if (!collaborator || !collaborator.canEdit) {
      socket.emit("collabError", {
        message: "Forbidden: You have view-only access and cannot edit this document",
      });
      return;
    }

    try {
      const updateBuffer = typeof update === "string" ? Buffer.from(update, "base64") : Buffer.from(update);
      const updateArray = new Uint8Array(updateBuffer);

      // Apply CRDT update conflict-free
      Y.applyUpdate(room.doc, updateArray);
      room.dirty = true;

      // Broadcast update to all other collaborators in the room with epoch
      socket.to(`doc_collab_${documentId}`).emit("docSyncUpdate", {
        documentId,
        update: typeof update === "string" ? update : updateBuffer.toString("base64"),
        epoch: currentRoomEpoch,
        senderSocketId: socket.id,
      });

      // Cross-pod propagation via Redis when active
      if (redisCoordinator.connected) {
        redisCoordinator.publish("docSyncUpdate", {
          documentId,
          update: typeof update === "string" ? update : updateBuffer.toString("base64"),
          epoch: currentRoomEpoch,
          senderSocketId: socket.id,
        }).catch(() => {});
      }

      // Debounce persistence to database
      if (room.debounceTimer) clearTimeout(room.debounceTimer);
      room.debounceTimer = setTimeout(() => {
        persistDocumentState(documentId);
      }, 3000);
    } catch (err) {
      console.error("Error applying docSyncUpdate:", err);
    }
  });

  // Collaborator cursor and selection movement
  socket.on("collabCursorMove", ({ documentId, cursor, selection }) => {
    if (!documentId) return;

    const room = activeDocRooms.get(documentId);
    if (!room || !room.collaborators.has(socket.id)) return;

    const collaborator = room.collaborators.get(socket.id);
    collaborator.cursor = cursor;
    collaborator.selection = selection;
    collaborator.lastActive = Date.now();

    socket.to(`doc_collab_${documentId}`).emit("collabCursorMoved", {
      socketId: socket.id,
      userId: collaborator.userId,
      name: collaborator.name,
      color: collaborator.color,
      role: collaborator.role,
      cursor,
      selection,
    });
  });

  // Helper function to cleanly handle socket leaving a document room
  const handleLeaveDocRoom = (documentId, socketId) => {
    const room = activeDocRooms.get(documentId);
    if (!room) return;

    if (room.connectedSockets.has(socketId)) {
      room.connectedSockets.delete(socketId);
      room.collaborators.delete(socketId);

      io.to(`doc_collab_${documentId}`).emit("collabUserLeft", {
        socketId,
        remainingCollaborators: Array.from(room.collaborators.values()),
      });

      // If room is now empty, immediately persist and clean up memory
      if (room.connectedSockets.size === 0) {
        if (room.debounceTimer) {
          clearTimeout(room.debounceTimer);
          room.debounceTimer = null;
        }
        persistDocumentState(documentId).finally(() => {
          activeDocRooms.delete(documentId);
        });
      }
    }
  };

  // Explicit leave document room
  socket.on("leaveDocumentCollab", ({ documentId }) => {
    if (!documentId) return;
    socket.leave(`doc_collab_${documentId}`);
    handleLeaveDocRoom(documentId, socket.id);
  });

  // Cleanup on socket disconnect
  socket.on("disconnect", () => {
    for (const [documentId, room] of activeDocRooms.entries()) {
      if (room.connectedSockets.has(socket.id)) {
        handleLeaveDocRoom(documentId, socket.id);
      }
    }
  });
};

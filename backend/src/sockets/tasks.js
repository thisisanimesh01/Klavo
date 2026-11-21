import { checkTaskAccess } from "../utils/authHelpers.js";

/**
 * Tracks active viewers per task: Map<taskId, Map<socketId, { socketId, userId, name, email, avatar }>>
 */
export const activeTaskViewers = new Map();

/**
 * Maps socket.id -> Set<taskId>
 */
export const socketTaskRooms = new Map();

export const getTaskViewersList = (taskId) => {
  const viewers = activeTaskViewers.get(taskId);
  if (!viewers) return [];
  return Array.from(viewers.values());
};

export const removeSocketFromTask = (io, taskId, socketId) => {
  const viewers = activeTaskViewers.get(taskId);
  if (!viewers) return;

  if (viewers.has(socketId)) {
    const viewer = viewers.get(socketId);
    viewers.delete(socketId);

    if (viewers.size === 0) {
      activeTaskViewers.delete(taskId);
    }

    io.to(`task_${taskId}`).emit("task:viewersUpdated", {
      taskId,
      socketId,
      userId: viewer.userId,
      viewers: getTaskViewersList(taskId),
    });
  }

  const roomSet = socketTaskRooms.get(socketId);
  if (roomSet) {
    roomSet.delete(taskId);
    if (roomSet.size === 0) {
      socketTaskRooms.delete(socketId);
    }
  }
};

export const cleanupSocketTaskRooms = (io, socketId) => {
  const roomSet = socketTaskRooms.get(socketId);
  if (!roomSet) return;

  for (const taskId of Array.from(roomSet)) {
    removeSocketFromTask(io, taskId, socketId);
  }
  socketTaskRooms.delete(socketId);
};

/**
 * Initializes real-time task collaboration Socket.IO event listeners.
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export const initTaskSockets = (io, socket) => {
  socket.on("task:join", async ({ taskId }) => {
    if (!taskId) return;

    if (!socket.user) {
      socket.emit("task:error", {
        message: "Unauthorized: Authentication required to join task collaboration room",
        taskId,
      });
      return;
    }

    try {
      const { hasAccess, task } = await checkTaskAccess(taskId, socket.user._id);
      if (!task) {
        socket.emit("task:error", { message: "Task not found", taskId });
        return;
      }
      if (!hasAccess) {
        socket.emit("task:error", {
          message: "Forbidden: You do not have access to this task",
          taskId,
        });
        return;
      }

      socket.join(`task_${taskId}`);

      if (!activeTaskViewers.has(taskId)) {
        activeTaskViewers.set(taskId, new Map());
      }

      const viewerData = {
        socketId: socket.id,
        userId: socket.user._id.toString(),
        name: socket.user.name || "Anonymous",
        email: socket.user.email || "",
        avatar: socket.user.avatar || null,
        joinedAt: Date.now(),
      };

      activeTaskViewers.get(taskId).set(socket.id, viewerData);

      if (!socketTaskRooms.has(socket.id)) {
        socketTaskRooms.set(socket.id, new Set());
      }
      socketTaskRooms.get(socket.id).add(taskId);

      // Emit viewer list update to all in the task room
      io.to(`task_${taskId}`).emit("task:viewersUpdated", {
        taskId,
        viewers: getTaskViewersList(taskId),
      });
    } catch (err) {
      socket.emit("task:error", { message: err.message || "Failed to join task room", taskId });
    }
  });

  socket.on("task:leave", ({ taskId }) => {
    if (!taskId) return;
    socket.leave(`task_${taskId}`);
    removeSocketFromTask(io, taskId, socket.id);
  });

  socket.on("disconnect", () => {
    cleanupSocketTaskRooms(io, socket.id);
  });
};

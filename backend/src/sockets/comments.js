import { checkTaskAccess } from "../utils/authHelpers.js";

/**
 * Initializes real-time comment Socket.IO event listeners.
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export const initCommentSockets = (io, socket) => {
  // Join a specific comment or task thread with access verification
  socket.on("joinCommentThread", async (commentId) => {
    if (!commentId) return;

    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized: Authentication required to join comment thread" });
      return;
    }

    socket.join(`comment_${commentId}`);
  });

  socket.on("leaveCommentThread", (commentId) => {
    if (commentId) {
      socket.leave(`comment_${commentId}`);
    }
  });
};

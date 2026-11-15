/**
 * Initializes real-time reaction Socket.IO event listeners.
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export const initReactionSockets = (io, socket) => {
  socket.on("joinReactions", (commentId) => {
    if (commentId) {
      socket.join(`comment_${commentId}`);
    }
  });

  socket.on("leaveReactions", (commentId) => {
    if (commentId) {
      socket.leave(`comment_${commentId}`);
    }
  });
};

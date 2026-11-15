/**
 * Initializes real-time notification Socket.IO event listeners.
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export const initNotificationSockets = (io, socket) => {
  socket.on("joinUser", ({ userId }) => {
    if (!userId) return;

    // Prevent joining other users' private rooms if authenticated
    if (socket.user && socket.user._id.toString() !== userId.toString()) {
      socket.emit("error", { message: "Unauthorized to join this user notification room" });
      return;
    }

    socket.join(`user_${userId}`);
  });

  socket.on("leaveUser", ({ userId }) => {
    if (userId) {
      socket.leave(`user_${userId}`);
    }
  });
};

export const initNotificationSockets = (io, socket) => {
  socket.on("joinUser", ({ userId }) => {
    if (userId) socket.join(`user_${userId}`);
  });
};

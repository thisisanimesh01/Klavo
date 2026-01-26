export const initReactionSockets = (io, socket) => {
  socket.on("joinReactions", (commentId) => {
    socket.join(`comment_${commentId}`);
  });
};

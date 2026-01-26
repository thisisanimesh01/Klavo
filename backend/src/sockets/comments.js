export const initCommentSockets = (io, socket) => {
  socket.on("joinCommentThread", (commentId) => {
    socket.join(`comment_${commentId}`);
  });
};

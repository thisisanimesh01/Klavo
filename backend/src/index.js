import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import { connectDB, closeDB } from "./config/db.js";
import { User } from "./models/User.js";
import { checkTeamAccess, checkProjectAccess } from "./utils/authHelpers.js";
import { initCommentSockets } from "./sockets/comments.js";
import { initReactionSockets } from "./sockets/reactions.js";
import { initNotificationSockets } from "./sockets/notifications.js";
import { initDocumentSockets } from "./sockets/documents.js";
import { createApp } from "./app.js";

const app = createApp();
const server = createServer(app);

//socket.io setup
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.set("io", io);

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1] ||
      socket.handshake.query?.token;

    if (!token) {
      socket.user = null;
      return next();
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new Error("Authentication failed: User not found"));
    }

    socket.user = user;
    next();
  } catch (err) {
    socket.user = null;
    next();
  }
});

io.on("connection", (socket) => {
  // Initialize sub-socket handlers
  initNotificationSockets(io, socket);
  initCommentSockets(io, socket);
  initReactionSockets(io, socket);
  initDocumentSockets(io, socket);

  // Leave user room
  socket.on("leaveUser", ({ userId }) => {
    if (userId) socket.leave(`user_${userId}`);
  });

  // Join team room with authorization
  socket.on("joinTeam", async ({ teamId }) => {
    if (!teamId) return;

    if (socket.user) {
      const { isMember } = await checkTeamAccess(teamId, socket.user._id);
      if (isMember) {
        socket.join(`team_${teamId}`);
      } else {
        socket.emit("error", { message: "Unauthorized to join this team room" });
      }
    } else {
      socket.join(`team_${teamId}`);
    }
  });

  socket.on("leaveTeam", ({ teamId }) => {
    if (teamId) socket.leave(`team_${teamId}`);
  });

  // Join project room with authorization
  socket.on("joinProject", async ({ projectId }) => {
    if (!projectId) return;

    if (socket.user) {
      const { hasAccess } = await checkProjectAccess(projectId, socket.user._id);
      if (hasAccess) {
        socket.join(`project_${projectId}`);
      } else {
        socket.emit("error", { message: "Unauthorized to join this project room" });
      }
    } else {
      socket.join(`project_${projectId}`);
    }
  });

  socket.on("leaveProject", ({ projectId }) => {
    if (projectId) socket.leave(`project_${projectId}`);
  });

  socket.on("disconnect", () => {});
});

//connect to database
connectDB();

//start server
const PORT = env.PORT || 5050;

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Graceful Shutdown Handling
const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log("HTTP server closed.");
    await closeDB();
    process.exit(0);
  });

  // Force exit if shutdown hangs beyond 10 seconds
  setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

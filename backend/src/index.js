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
import { logger } from "./utils/logger.js";
import { metrics } from "./utils/metrics.js";
import { redisCoordinator } from "./utils/redisCoordinator.js";
import { recurringScheduler } from "./utils/recurringScheduler.js";

const app = createApp();
const server = createServer(app);

//socket.io setup
const socketCorsOrigin = (origin, callback) => {
  if (!origin || !env.isProduction) {
    return callback(null, true);
  }
  if (env.ALLOWED_ORIGINS.includes(origin) || env.FRONTEND_URL === origin) {
    return callback(null, true);
  }
  return callback(new Error("Socket CORS violation: Origin not allowed"), false);
};

const io = new Server(server, {
  cors: {
    origin: socketCorsOrigin,
    credentials: true,
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
  metrics.recordSocketConnect();
  logger.debug("Socket.IO client connected", { socketId: socket.id, userId: socket.user?._id });

  // Initialize sub-socket handlers
  initNotificationSockets(io, socket);
  initCommentSockets(io, socket);
  initReactionSockets(io, socket);
  initDocumentSockets(io, socket);

  // Leave user room
  socket.on("leaveUser", ({ userId }) => {
    if (userId) socket.leave(`user_${userId}`);
  });

  // Join team room with authorization (requires authenticated user)
  socket.on("joinTeam", async ({ teamId }) => {
    if (!teamId) return;

    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized: Authentication required to join team room" });
      return;
    }

    const { isMember } = await checkTeamAccess(teamId, socket.user._id);
    if (isMember) {
      socket.join(`team_${teamId}`);
    } else {
      socket.emit("error", { message: "Unauthorized to join this team room" });
    }
  });

  socket.on("leaveTeam", ({ teamId }) => {
    if (teamId) socket.leave(`team_${teamId}`);
  });

  // Join project room with authorization (requires authenticated user)
  socket.on("joinProject", async ({ projectId }) => {
    if (!projectId) return;

    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized: Authentication required to join project room" });
      return;
    }

    const { hasAccess } = await checkProjectAccess(projectId, socket.user._id);
    if (hasAccess) {
      socket.join(`project_${projectId}`);
    } else {
      socket.emit("error", { message: "Unauthorized to join this project room" });
    }
  });

  socket.on("leaveProject", ({ projectId }) => {
    if (projectId) socket.leave(`project_${projectId}`);
  });

  socket.on("disconnect", () => {
    metrics.recordSocketDisconnect();
    logger.debug("Socket.IO client disconnected", { socketId: socket.id });
  });
});

//connect to database
await connectDB();

// Connect to Redis coordinator if configured
if (env.REDIS_URL) {
  try {
    await redisCoordinator.connect();
  } catch (redisErr) {
    logger.warn("Redis coordinator initialization failed; running in single-instance mode", {
      error: redisErr.message,
    });
  }
}

// Initialize recurring task scheduler
recurringScheduler.setIO(io);
recurringScheduler.start();

//start server
const PORT = env.PORT || 5050;

server.listen(PORT, () => {
  logger.info(`Server started successfully`, { port: PORT, env: env.NODE_ENV });
});

// Graceful Shutdown Handling
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  recurringScheduler.stop();
  if (redisCoordinator.connected) {
    await redisCoordinator.close();
  }
  server.close(async () => {
    logger.info("HTTP server closed cleanly");
    await closeDB();
    process.exit(0);
  });

  // Force exit if shutdown hangs beyond 10 seconds
  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

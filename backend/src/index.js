import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import taskTemplateRoutes from "./routes/taskTemplateRoutes.js";
import sprintRoutes from "./routes/sprintRoutes.js";
import milestoneRoutes from "./routes/milestoneRoutes.js";
import workflowRoutes from "./routes/workflowRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import reactionRoutes from "./routes/reactionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";

const app = express();
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

//middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

//connect to database
connectDB();

//routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/task-templates", taskTemplateRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/reactions", reactionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/", (req, res) => {
  res.send("Klavo backend running!");
});

// 404 and Centralized Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

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

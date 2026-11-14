import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { User } from "./models/User.js";
import { checkTeamAccess, checkProjectAccess } from "./utils/authHelpers.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
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
  // Join own user room
  socket.on("joinUser", ({ userId }) => {
    if (socket.user && socket.user._id.toString() === userId) {
      socket.join(`user_${userId}`);
    } else if (!socket.user && userId) {
      socket.join(`user_${userId}`);
    }
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

//start server
const PORT = env.PORT || 5050;

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

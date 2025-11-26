// backend/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/db.js";
import { createServer } from "http";
import { Server } from "socket.io";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";

dotenv.config();

const app = express();
const server = createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});
app.set("io", io);

// Basic socket connection handlers
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // join a user's private room so server can emit per-user events
  socket.on("joinUser", ({ userId }) => {
    if (!userId) return;
    socket.join(`user_${userId}`);
    console.log(`Socket ${socket.id} joined user_${userId}`);
  });

  // join a team room (for team-wide broadcasts)
  socket.on("joinTeam", ({ teamId }) => {
    if (!teamId) return;
    socket.join(`team_${teamId}`);
    console.log(`Socket ${socket.id} joined team_${teamId}`);
  });

  // join a project room (for project-level events)
  socket.on("joinProject", ({ projectId }) => {
    if (!projectId) return;
    socket.join(`project_${projectId}`);
    console.log(`Socket ${socket.id} joined project_${projectId}`);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Connect DB
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/activity", activityRoutes);

app.get("/", (req, res) => {
  res.send("Klavo backend running...!");
});

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

import messageRoutes from "./routes/messageRoutes.js";
app.use("/api/messages", messageRoutes);

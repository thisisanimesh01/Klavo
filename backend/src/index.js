import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";


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

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("joinUser", ({ userId }) => {
    if (userId) socket.join(`user_${userId}`);
  });

  socket.on("joinTeam", ({ teamId }) => {
    if (teamId) socket.join(`team_${teamId}`);
  });

  socket.on("joinProject", ({ projectId }) => {
    if (projectId) socket.join(`project_${projectId}`);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
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

app.get("/", (req, res) => {
  res.send("Klavo backend running!");
});

//start server
const PORT = env.PORT || 5050;

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

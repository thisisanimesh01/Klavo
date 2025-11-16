import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/db.js";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/authRoutes.js";


dotenv.config();

const app = express();
const server = createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});
app.set("io", io);

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Connect Database
connectDB();

// Routes
app.use("/api/auth", authRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Klavo backend running...");
});

const PORT = 5050;


server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);  
});

import teamRoutes from "./routes/teamRoutes.js";

app.use("/api/teams", teamRoutes);

import projectRoutes from "./routes/projectRoutes.js";

app.use("/api/projects", projectRoutes);

import taskRoutes from "./routes/taskRoutes.js";

app.use("/api/tasks", taskRoutes);

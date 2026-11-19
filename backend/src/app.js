import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { securityHeaders } from "./middleware/securityHeaders.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import taskTemplateRoutes from "./routes/taskTemplateRoutes.js";
import sprintRoutes from "./routes/sprintRoutes.js";
import milestoneRoutes from "./routes/milestoneRoutes.js";
import workflowRoutes from "./routes/workflowRoutes.js";
import savedViewRoutes from "./routes/savedViewRoutes.js";
import automationRoutes from "./routes/automationRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import reactionRoutes from "./routes/reactionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";

export const createApp = (options = {}) => {
  const app = express();

  // Security Headers (REL-03)
  app.use(securityHeaders);

  // Middleware
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(cookieParser());

  // Mount IO instance if provided
  if (options.io) {
    app.set("io", options.io);
  }

  // Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/teams", teamRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/task-templates", taskTemplateRoutes);
  app.use("/api/sprints", sprintRoutes);
  app.use("/api/milestones", milestoneRoutes);
  app.use("/api/workflows", workflowRoutes);
  app.use("/api/saved-views", savedViewRoutes);
  app.use("/api/automations", automationRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/activity", activityRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/reactions", reactionRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/files", fileRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/search", searchRoutes);

  app.get("/", (req, res) => {
    res.send("Klavo backend running!");
  });

  // 404 and Centralized Error Handling Middlewares
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;

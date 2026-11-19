import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { requestCorrelation, requestLogger } from "./middleware/requestLogger.js";
import { metricsMiddleware } from "./utils/metrics.js";

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
import healthRoutes from "./routes/healthRoutes.js";

export const createApp = (options = {}) => {
  const app = express();

  // Trust reverse proxy (ELB, Nginx, Cloudflare) when configured or in production
  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  // Request correlation context & tracing (REL-07)
  app.use(requestCorrelation);

  // Security Headers (REL-03)
  app.use(securityHeaders);

  // Dynamic CORS configuration: in production strictly match allowed origins; in dev permit origin
  const corsOrigin = (origin, callback) => {
    if (!origin || !env.isProduction) {
      return callback(null, true);
    }
    if (env.ALLOWED_ORIGINS.includes(origin) || env.FRONTEND_URL === origin) {
      return callback(null, true);
    }
    return callback(new Error("CORS policy violation: Origin not allowed"), false);
  };

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-ID"],
      exposedHeaders: ["X-Request-ID"],
    })
  );

  app.use(express.json());
  app.use(cookieParser());

  // Metrics telemetry and request logging (REL-07)
  app.use(metricsMiddleware);
  app.use(requestLogger);

  // Mount IO instance if provided
  if (options.io) {
    app.set("io", options.io);
  }

  // Operational Health, Liveness, Readiness & Metrics (REL-07)
  app.use("/api/health", healthRoutes);

  // Root health probe
  app.get("/", (req, res) => {
    res.send("Klavo backend running!");
  });

  // Domain Routes
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

  // 404 and Centralized Error Handling Middlewares
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;

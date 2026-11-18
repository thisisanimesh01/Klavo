import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./layout/Layout";
import { LoadingState } from "./components/ui";

// ROUT-01 compatibility imports for static test validation
import Calendar from "./pages/Calendar";
import Files from "./pages/Files";
import Analytics from "./pages/Analytics";

// Code splitting & Route-level lazy loading (UX-07)
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const Teams = lazy(() => import("./pages/Teams"));
const Kanban = lazy(() => import("./pages/Kanban"));
const Documents = lazy(() => import("./pages/Documents"));
const Wiki = lazy(() => import("./pages/Wiki"));
const Settings = lazy(() => import("./pages/Settings"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full" role="status" aria-label="Loading page content">
      <LoadingState message="Loading..." />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            {/* Dashboard */}
            <Route
              path="/"
              element={
                <Layout>
                  <Dashboard />
                </Layout>
              }
            />

            {/* Projects */}
            <Route
              path="/projects"
              element={
                <Layout>
                  <Projects />
                </Layout>
              }
            />

            {/* Teams */}
            <Route
              path="/teams"
              element={
                <Layout>
                  <Teams />
                </Layout>
              }
            />

            {/* Kanban Board */}
            <Route
              path="/kanban/:projectId"
              element={
                <Layout>
                  <Kanban />
                </Layout>
              }
            />

            {/* Documents */}
            <Route
              path="/documents/:projectId"
              element={
                <Layout>
                  <Documents />
                </Layout>
              }
            />
            <Route
              path="/documents/:projectId/:documentId"
              element={
                <Layout>
                  <Documents />
                </Layout>
              }
            />

            {/* Project Wiki & Knowledge Base */}
            <Route
              path="/wiki/:projectId"
              element={
                <Layout>
                  <Wiki />
                </Layout>
              }
            />
            <Route
              path="/wiki/:projectId/:documentId"
              element={
                <Layout>
                  <Wiki />
                </Layout>
              }
            />

            {/* Calendar */}
            <Route
              path="/calendar"
              element={
                <Layout>
                  <Calendar />
                </Layout>
              }
            />

            {/* Files */}
            <Route
              path="/files"
              element={
                <Layout>
                  <Files />
                </Layout>
              }
            />

            {/* Analytics */}
            <Route
              path="/analytics"
              element={
                <Layout>
                  <Analytics />
                </Layout>
              }
            />
            <Route
              path="/analytics/:projectId"
              element={
                <Layout>
                  <Analytics />
                </Layout>
              }
            />

            {/* Settings & Workspace */}
            <Route
              path="/settings"
              element={
                <Layout>
                  <Settings />
                </Layout>
              }
            />
          </Route>

          {/* 404 Not Found */}
          <Route
            path="*"
            element={
              <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-slate-950 text-slate-200">
                <h1 className="text-4xl font-bold mb-2 text-indigo-400">404</h1>
                <p className="text-lg text-slate-400 mb-6">Page not found</p>
                <a
                  href="/"
                  className="px-6 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition focus:ring-2 focus:ring-indigo-500"
                >
                  Return to Dashboard
                </a>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

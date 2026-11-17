import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Teams from "./pages/Teams";
import Kanban from "./pages/Kanban";
import Calendar from "./pages/Calendar";
import Files from "./pages/Files";
import Analytics from "./pages/Analytics";
import Documents from "./pages/Documents";
import Wiki from "./pages/Wiki";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./layout/Layout";

export default function App() {
  return (
    <BrowserRouter>
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

          {/* Project Wiki & Knowledge Base (DOC-07) */}
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
                className="px-6 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
              >
                Return to Dashboard
              </a>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

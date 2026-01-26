import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Teams from "./pages/Teams";
import Kanban from "./pages/Kanban";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./layout/Layout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          {/* Dashboard WITHOUT sidebar */}
          <Route path="/" element={<Dashboard />} />

          {/* These pages need sidebar */}
          <Route
            path="/projects"
            element={
              <Layout>
                <Projects />
              </Layout>
            }
          />

          <Route
            path="/teams"
            element={
              <Layout>
                <Teams />
              </Layout>
            }
          />

          <Route
            path="/kanban/:projectId"
            element={
              <Layout>
                <Kanban />
              </Layout>
            }
          />
        </Route>

        {/* 404 */}
        <Route
          path="*"
          element={<div className="p-6 text-center text-2xl">Page not found</div>}
        />
      </Routes>
    </BrowserRouter>
  );
}

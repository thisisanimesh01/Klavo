// frontend/src/pages/Dashboard.jsx
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../store/slices/authSlice";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import ActivityCard from "../components/ActivityCard";

export default function Dashboard() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  return (
    <div className="min-h-screen app-bg p-6">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Klavo</h1>

          <div className="flex items-center gap-4">
            <ThemeToggle />

            <div className="font-medium">{user?.name}</div>

            <button
              onClick={() => dispatch(logout())}
              className="px-3 py-1 border rounded text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="space-y-6">

          <Link
            to="/projects"
            className="block app-card p-6 rounded-xl shadow hover:shadow-md transition text-xl font-medium"
          >
            📁 View Projects →
          </Link>

          <Link
            to="/teams"
            className="block app-card p-6 rounded-xl shadow hover:shadow-md transition text-xl font-medium"
          >
            👥 Manage Teams →
          </Link>

        </main>

      </div>
    </div>
  );
}

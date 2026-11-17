import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import ProjectModal from "../components/ProjectModal";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import socket from "../socket";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);

  const navigate = useNavigate();

  const loadProjects = async () => {
    try {
      const res = await axiosClient.get("/projects");
      setProjects(res.data);

      // 👉 JOIN SOCKET ROOM FOR ALL TEAMS THAT USER BELONGS TO
      const uniqueTeams = [...new Set(res.data.map((p) => p.teamId?._id))];

      if (!socket.connected) socket.connect();

      uniqueTeams.forEach((teamId) => {
        if (teamId) socket.emit("joinTeam", { teamId });
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // SOCKET LISTENERS
  useEffect(() => {
    if (!socket.connected) socket.connect();

    // 👉 When project is created by any user
    socket.on("projectCreated", (newProject) => {
      setProjects((prev) => {
        if (prev.find((p) => p._id === newProject._id)) return prev;
        return [...prev, newProject];
      });
    });

    // 👉 When project is deleted by any user
    socket.on("projectDeleted", ({ projectId }) => {
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
    });

    return () => {
      socket.off("projectCreated");
      socket.off("projectDeleted");
    };
  }, []);

  const deleteProject = async (id) => {
    if (!confirm("Delete this project?")) return;

    try {
      await axiosClient.delete(`/projects/${id}`);
      // No need to refresh manually — socket will update
    } catch (err) {
      alert("Failed to delete project");
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen app-bg p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your Projects</h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded"
              onClick={() => setOpenModal(true)}
            >
              + Create Project
            </button>
          </div>
        </header>

        {projects.length === 0 ? (
          <p>No projects yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.map((p) => (
              <div key={p._id} className="app-card p-4 rounded shadow">
                <h2 className="text-lg font-semibold mb-1">{p.name}</h2>

                {p.teamId && (
                  <p className="text-xs text-slate-500 mb-2">
                    Team: {p.teamId.name}
                  </p>
                )}

                {p.description && (
                  <p className="text-sm text-slate-600 mb-3">
                    {p.description}
                  </p>
                )}

                <div className="flex flex-wrap justify-between gap-2">
                  <button
                    className="flex-1 border py-2 rounded text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    onClick={() => navigate(`/kanban/${p._id}`)}
                  >
                    Open Board
                  </button>

                  <button
                    className="flex-1 border py-2 rounded text-sm text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    onClick={() => navigate(`/wiki/${p._id}`)}
                  >
                    Wiki
                  </button>

                  <button
                    className="border px-3 py-2 rounded text-sm text-red-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                    onClick={() => deleteProject(p._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProjectModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSuccess={loadProjects}
      />
    </div>
  );
}

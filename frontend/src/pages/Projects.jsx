import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import ProjectModal from "../components/ProjectModal";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import socket from "../socket";
import { Button, Card, EmptyState, LoadingState, Badge } from "../components/ui";
import { Plus, Kanban, BookOpen, BarChart3, Trash2, FolderKanban } from "lucide-react";

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

  if (loading) return <LoadingState message="Loading projects..." className="min-h-screen app-bg" />;

  return (
    <div className="min-h-screen app-bg p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderKanban className="text-indigo-500" size={26} />
              <span>Your Projects</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Manage tasks, knowledge base, and team performance metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              variant="primary"
              size="sm"
              leftIcon={Plus}
              onClick={() => setOpenModal(true)}
            >
              Create Project
            </Button>
          </div>
        </header>

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to start organizing tasks, documentation, and sprints."
            action={
              <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => setOpenModal(true)}>
                Create Project
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.map((p) => (
              <Card key={p._id} padding="md" hoverable className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h2 className="text-base font-semibold text-slate-100">{p.name}</h2>
                    {p.teamId && (
                      <Badge variant="neutral" size="xs">
                        {p.teamId.name}
                      </Badge>
                    )}
                  </div>

                  {p.description && (
                    <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                  <Button
                    variant="outline"
                    size="xs"
                    leftIcon={Kanban}
                    className="flex-1"
                    onClick={() => navigate(`/kanban/${p._id}`)}
                  >
                    Board
                  </Button>

                  <Button
                    variant="outline"
                    size="xs"
                    leftIcon={BookOpen}
                    className="flex-1"
                    onClick={() => navigate(`/wiki/${p._id}`)}
                  >
                    Wiki
                  </Button>

                  <Button
                    variant="outline"
                    size="xs"
                    leftIcon={BarChart3}
                    className="flex-1"
                    onClick={() => navigate(`/analytics/${p._id}`)}
                  >
                    Analytics
                  </Button>

                  <Button
                    variant="danger"
                    size="xs"
                    leftIcon={Trash2}
                    onClick={() => deleteProject(p._id)}
                    title="Delete project"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
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

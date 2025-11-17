// frontend/src/pages/Projects.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import ProjectModal from "../components/ProjectModal";

export default function Projects() {
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);

  /* -----------------------------------------
     Fetch Teams of Logged-in User
  ------------------------------------------*/
  const fetchTeams = async () => {
    try {
      const res = await axiosClient.get("/teams/my-teams");
      setTeams(res.data);
    } catch (err) {
      console.error("Teams fetch error:", err);
    }
  };

  /* -----------------------------------------
     Fetch Projects for All Teams
  ------------------------------------------*/
  const fetchProjects = async () => {
    try {
      setLoading(true);
      let allProjects = [];

      if (teams.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      for (const team of teams) {
        const res = await axiosClient.get(`/projects/team/${team._id}`);
        allProjects.push(...res.data);
      }

      setProjects(allProjects);
      setLoading(false);
    } catch (err) {
      console.error("Projects fetch error:", err);
      setLoading(false);
    }
  };

  /* -----------------------------------------
     Run on Page Load
  ------------------------------------------*/
  useEffect(() => {
    fetchTeams();
  }, []);

  /* -----------------------------------------
     Run when Teams Change
  ------------------------------------------*/
  useEffect(() => {
    fetchProjects();
  }, [teams]);

  /* -----------------------------------------
     Handle new project from modal
  ------------------------------------------*/
  const handleProjectCreated = (project) => {
    setProjects((prev) => [...prev, project]);
  };

  /* -----------------------------------------
     UI
  ------------------------------------------*/
  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Your Projects</h1>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded"
            onClick={() => setOpenModal(true)}
          >
            + New Project
          </button>
        </div>

        {/* When no projects */}
        {projects.length === 0 ? (
          <div className="text-gray-500 mt-10 text-center">
            No projects found. Create one!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.map((p) => (
              <Link
                to={`/kanban/${p._id}`}
                key={p._id}
                className="bg-white p-4 rounded shadow hover:shadow-md transition"
              >
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{p.description}</p>
                <div className="text-xs mt-2 text-slate-500">
                  Team: {p.teamId?.name || "Unknown"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Project Modal */}
      <ProjectModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSuccess={handleProjectCreated}
        teams={teams}
      />
    </div>
  );
}

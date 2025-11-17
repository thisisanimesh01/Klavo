import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import ProjectModal from "../components/ProjectModal";

export default function Projects() {
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTeams = async () => {
    const res = await axiosClient.get("/teams/my-teams");
    setTeams(res.data);
  };

  const fetchProjects = async () => {
    const allProjects = [];

    for (const team of teams) {
      const res = await axiosClient.get(`/projects/team/${team._id}`);
      allProjects.push(...res.data);
    }

    setProjects(allProjects);
    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (teams.length > 0) fetchProjects();
  }, [teams]);

  const handleNewProject = (project) => {
    setProjects((prev) => [...prev, project]);
  };

  if (loading) return <div className="p-6">Loading...</div>;

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
      </div>

      <ProjectModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        teams={teams}
        onSuccess={handleNewProject}
      />
    </div>
  );
}

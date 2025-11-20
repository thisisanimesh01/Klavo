// frontend/src/components/ProjectModal.jsx
import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";

export default function ProjectModal({ open, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await axiosClient.get("/teams/my-teams");
        setTeams(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    if (open) fetchTeams();
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post("/projects", {
        name,
        description,
        teamId,
      });
      setName("");
      setDescription("");
      setTeamId("");
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create project");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="app-card p-6 rounded-lg w-96 shadow">
        <h2 className="text-xl font-semibold mb-4">Create Project</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full border p-2 rounded bg-transparent"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="w-full border p-2 rounded bg-transparent"
            rows={3}
            placeholder="Short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select
            className="w-full border p-2 rounded bg-transparent"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">Select team</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>

          <button className="w-full bg-indigo-600 text-white py-2 rounded">
            Create Project
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full border py-2 rounded"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

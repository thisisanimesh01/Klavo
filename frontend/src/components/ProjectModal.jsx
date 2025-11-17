import React, { useState } from "react";
import axiosClient from "../api/axiosClient";

export default function ProjectModal({ open, onClose, teams, onSuccess }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    teamId: "",
  });

  const createProject = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post("/projects", form);
      onSuccess(res.data.project);
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50 px-4">
      <div className="bg-white p-6 rounded-xl w-full max-w-md shadow">
        <h2 className="text-xl font-semibold mb-4">Create Project</h2>

        <form className="space-y-4" onSubmit={createProject}>
          <input
            className="w-full border px-3 py-2 rounded"
            placeholder="Project Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <textarea
            className="w-full border px-3 py-2 rounded"
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <select
            className="w-full border px-3 py-2 rounded"
            required
            value={form.teamId}
            onChange={(e) => setForm({ ...form, teamId: e.target.value })}
          >
            <option value="">Select Team</option>
            {teams.map((t) => (
              <option value={t._id} key={t._id}>
                {t.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded"
          >
            Create Project
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 border rounded"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

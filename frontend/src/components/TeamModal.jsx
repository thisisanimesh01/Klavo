import React, { useState } from "react";
import axiosClient from "../api/axiosClient";

export default function TeamModal({ open, onClose, onSuccess }) {
  const [teamName, setTeamName] = useState("");

  const createTeam = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post("/teams", { name: teamName });
      onSuccess(res.data.team);
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50 px-4">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Create New Team</h2>

        <form className="space-y-4" onSubmit={createTeam}>
          <input
            className="w-full border px-3 py-2 rounded"
            placeholder="Team Name"
            value={teamName}
            required
            onChange={(e) => setTeamName(e.target.value)}
          />

          <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">
            Create Team
          </button>

          <button type="button" className="w-full border py-2 rounded" onClick={onClose}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import axiosClient from "../api/axiosClient";

export default function TeamModal({ open, onClose, onSuccess }) {
  const [teamName, setTeamName] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post("/teams", { name: teamName });
      setTeamName("");
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Something went wrong");
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 overflow-y-auto">
      <div className="app-card p-5 sm:p-6 rounded-2xl w-full max-w-sm shadow-xl my-auto">
        <h2 className="text-xl font-semibold mb-4">Create New Team</h2>
        <form onSubmit={handleSubmit}>
          <input
            className="w-full border p-2 rounded mb-4 bg-transparent"
            placeholder="Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded"
          >
            Create Team
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-3 border py-2 rounded"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

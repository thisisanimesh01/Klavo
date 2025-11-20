// frontend/src/components/AddMemberModal.jsx
import React, { useState } from "react";
import axiosClient from "../api/axiosClient";

export default function AddMemberModal({
  open,
  onClose,
  teamId,
  onSuccess,
}) {
  const [email, setEmail] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post("/teams/add-member", {
        teamId,
        email,
      });
      setEmail("");
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add member");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="app-card p-6 rounded-lg w-96 shadow">
        <h2 className="text-xl font-semibold mb-4">Add Member to Team</h2>

        <form onSubmit={handleSubmit}>
          <input
            className="w-full border p-2 rounded mb-4 bg-transparent"
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded"
          >
            Add Member
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

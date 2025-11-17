import React, { useState } from "react";
import axiosClient from "../api/axiosClient";

export default function AddMemberModal({ open, onClose, teamId, onSuccess }) {
  const [email, setEmail] = useState("");

  const addMember = async (e) => {
    e.preventDefault();
    try {
      // Find user by email
      const userRes = await axiosClient.post("/auth/find", { email });
      const userId = userRes.data.user?._id;

      if (!userId) {
        alert("User not found");
        return;
      }

      await axiosClient.post("/teams/add-member", {
        teamId,
        memberId: userId,
      });

      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50 px-4">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Add Member to Team</h2>

        <form className="space-y-4" onSubmit={addMember}>
          <input
            type="email"
            className="w-full border px-3 py-2 rounded"
            placeholder="Enter user email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">
            Add Member
          </button>

          <button type="button" className="w-full border py-2 rounded" onClick={onClose}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

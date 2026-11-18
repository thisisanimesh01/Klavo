import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { Modal, Button, Input, Select } from "./ui";

export default function ProjectModal({ open, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await axiosClient.get("/teams/my-teams");
        setTeams(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    if (open) {
      setError(null);
      fetchTeams();
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await axiosClient.post("/projects", {
        name: name.trim(),
        description: description.trim(),
        teamId: teamId || undefined,
      });
      setName("");
      setDescription("");
      setTeamId("");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Create New Project"
      subtitle="Organize tasks, documents, and sprints within a team"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Name *"
          placeholder="e.g. Mobile App Redesign"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          error={error}
          autoFocus
        />

        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-slate-300">
            Description (Optional)
          </label>
          <textarea
            className="w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 placeholder-slate-500 text-sm p-3 transition duration-150 focus:outline-none focus:ring-2 focus:border-indigo-500 focus:ring-indigo-500/30 resize-none"
            rows={3}
            placeholder="Brief goals and summary of this project..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <Select
          label="Team / Workspace"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          helperText="Associate this project with a team for member access"
        >
          <option value="">No team (Personal)</option>
          {teams.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
            </option>
          ))}
        </Select>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={loading}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
}

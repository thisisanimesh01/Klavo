import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";
import { X, Flag, Calendar, AlertCircle, User, CheckCircle2 } from "lucide-react";

export default function MilestoneModal({
  open,
  onClose,
  projectId,
  initialMilestone,
  onSaved,
}) {
  const isEdit = Boolean(initialMilestone);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("planned");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit && initialMilestone) {
      setName(initialMilestone.name || "");
      setDescription(initialMilestone.description || "");
      setStartDate(
        initialMilestone.startDate
          ? new Date(initialMilestone.startDate).toISOString().split("T")[0]
          : ""
      );
      setDueDate(
        initialMilestone.dueDate
          ? new Date(initialMilestone.dueDate).toISOString().split("T")[0]
          : ""
      );
      setStatus(initialMilestone.status || "planned");
    } else {
      setName("");
      setDescription("");
      setStartDate("");
      setDueDate("");
      setStatus("planned");
    }
    setError(null);
  }, [open, isEdit, initialMilestone]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Milestone name is required");
      return;
    }

    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      setError("Start date cannot be after due date");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        description: description ? description.trim() : "",
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
        projectId,
      };

      let res;
      if (isEdit) {
        res = await axiosClient.put(`/milestones/${initialMilestone._id}`, payload);
      } else {
        res = await axiosClient.post("/milestones", payload);
      }

      onSaved && onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save milestone");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="app-card border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-lg">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isEdit ? "Edit Milestone" : "Create Project Milestone"}
              </h2>
              <p className="text-xs text-slate-500">
                Track major deliverables, timelines, target dates, and release gates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Milestone Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Phase 1 Release / Beta Readiness"
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm focus:ring-2 focus:ring-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Description & Deliverables
            </label>
            <textarea
              rows={3}
              placeholder="Primary goals, deliverables, and acceptance criteria..."
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Start Date
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Target Due Date
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Milestone Status
            </label>
            <select
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm capitalize"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50"
            >
              {saving ? "Saving..." : isEdit ? "Update Milestone" : "Create Milestone"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

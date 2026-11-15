import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";
import { X, Zap, Calendar, Target, AlertCircle, Gauge } from "lucide-react";

export default function SprintModal({
  open,
  onClose,
  projectId,
  initialSprint,
  onSaved,
}) {
  const isEdit = Boolean(initialSprint);

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit && initialSprint) {
      setName(initialSprint.name || "");
      setGoal(initialSprint.goal || "");
      setStartDate(
        initialSprint.startDate
          ? new Date(initialSprint.startDate).toISOString().split("T")[0]
          : ""
      );
      setEndDate(
        initialSprint.endDate
          ? new Date(initialSprint.endDate).toISOString().split("T")[0]
          : ""
      );
      setCapacity(initialSprint.capacity !== undefined && initialSprint.capacity !== null ? initialSprint.capacity : "");
    } else {
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      setCapacity("");
    }
    setError(null);
  }, [open, isEdit, initialSprint]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Sprint name is required");
      return;
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setError("Start date cannot be after end date");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        goal: goal ? goal.trim() : "",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        capacity: capacity !== "" ? Number(capacity) : null,
        projectId,
      };

      let res;
      if (isEdit) {
        res = await axiosClient.put(`/sprints/${initialSprint._id}`, payload);
      } else {
        res = await axiosClient.post("/sprints", payload);
      }

      onSaved && onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save sprint");
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
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isEdit ? "Edit Sprint" : "Create New Sprint"}
              </h2>
              <p className="text-xs text-slate-500">
                Plan sprint iterations, timeline dates, goals, and team capacity
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
              Sprint Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sprint 14 - Auth & RBAC Hardening"
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm focus:ring-2 focus:ring-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Sprint Goal / Target Deliverable
            </label>
            <textarea
              rows={3}
              placeholder="Primary milestone objective for this iteration..."
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
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
                End Date
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              <Gauge className="w-3.5 h-3.5 text-indigo-500" />
              Team Capacity Limit (Hours)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 80 (estimated total team commitment)"
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Shows automated overload warnings if committed task hours exceed this threshold.
            </p>
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
              {saving ? "Saving..." : isEdit ? "Update Sprint" : "Create Sprint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

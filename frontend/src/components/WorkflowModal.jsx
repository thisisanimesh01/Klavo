import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";
import {
  X,
  Sliders,
  Plus,
  Trash2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

const CATEGORIES = [
  { id: "todo", label: "To Do / Backlog" },
  { id: "in_progress", label: "In Progress / Active" },
  { id: "review", label: "Review / QA" },
  { id: "done", label: "Done / Completed" },
];

export default function WorkflowModal({
  open,
  onClose,
  projectId,
  workflow,
  onSaved,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [statuses, setStatuses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (workflow) {
      setName(workflow.name || "Default Workflow");
      setDescription(workflow.description || "");
      setStatuses(
        Array.isArray(workflow.statuses) && workflow.statuses.length > 0
          ? JSON.parse(JSON.stringify(workflow.statuses))
          : [
              { key: "todo", name: "Todo", color: "#94a3b8", category: "todo", order: 0 },
              { key: "in-progress", name: "In Progress", color: "#3b82f6", category: "in_progress", order: 1 },
              { key: "review", name: "In Review", color: "#f59e0b", category: "review", order: 2 },
              { key: "done", name: "Done", color: "#10b981", category: "done", order: 3 },
            ]
      );
    }
    setError(null);
  }, [open, workflow]);

  if (!open) return null;

  const handleStatusChange = (index, field, value) => {
    setStatuses((prev) => {
      const copy = [...prev];
      copy[index][field] = value;
      if (field === "name" && (!copy[index].key || copy[index].key === "new-status")) {
        copy[index].key = value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
      }
      return copy;
    });
  };

  const handleAddStatus = () => {
    setStatuses((prev) => [
      ...prev,
      {
        key: `status-${prev.length + 1}`,
        name: "New Status",
        color: "#6366f1",
        category: "in_progress",
        order: prev.length,
      },
    ]);
  };

  const handleRemoveStatus = (index) => {
    if (statuses.length <= 2) {
      setError("Workflow must have at least 2 statuses");
      return;
    }
    setStatuses((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveStatus = (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === statuses.length - 1)) return;
    setStatuses((prev) => {
      const copy = [...prev];
      const targetIndex = index + direction;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((st, i) => ({ ...st, order: i }));
    });
  };

  const handleResetToDefault = async () => {
    if (!confirm("Reset workflow back to default 4-stage statuses? (Todo, In Progress, Review, Done)")) return;
    try {
      setResetting(true);
      setError(null);
      const res = await axiosClient.post(`/workflows/project/${projectId}/reset`);
      onSaved && onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to reset workflow");
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const hasTodo = statuses.some((s) => s.category === "todo");
    const hasDone = statuses.some((s) => s.category === "done");
    if (!hasTodo || !hasDone) {
      setError("Workflow must contain at least one status in 'To Do' category and one in 'Done' category.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        description: description.trim(),
        statuses: statuses.map((s, idx) => ({
          ...s,
          order: idx,
        })),
      };

      const res = await axiosClient.put(`/workflows/project/${projectId}`, payload);
      onSaved && onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="app-card border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-2xl w-full max-w-2xl shadow-2xl my-auto max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Customize Project Workflow
              </h2>
              <p className="text-xs text-slate-500">
                Configure custom statuses, display colors, categories, and Kanban board columns
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Workflow Name *
              </label>
              <input
                type="text"
                required
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm focus:ring-2 focus:ring-indigo-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Description
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                Workflow Statuses ({statuses.length})
              </label>
              <button
                type="button"
                onClick={handleAddStatus}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add Status
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {statuses.map((status, idx) => (
                <div
                  key={idx}
                  className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 flex flex-wrap sm:flex-nowrap items-center gap-3 text-xs"
                >
                  <div className="flex items-center gap-1 shrink-0 text-slate-400">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStatus(idx, -1)}
                      className="px-1 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === statuses.length - 1}
                      onClick={() => handleMoveStatus(idx, 1)}
                      className="px-1 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="flex-1 min-w-[130px]">
                    <input
                      type="text"
                      required
                      placeholder="Status Name"
                      value={status.name}
                      onChange={(e) => handleStatusChange(idx, "name", e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 font-medium"
                    />
                  </div>

                  <div className="w-32 shrink-0">
                    <input
                      type="text"
                      required
                      placeholder="key (slug)"
                      value={status.key}
                      onChange={(e) => handleStatusChange(idx, "key", e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-700 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 font-mono text-[11px]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="color"
                      value={status.color || "#6366f1"}
                      onChange={(e) => handleStatusChange(idx, "color", e.target.value)}
                      className="w-7 h-7 rounded border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                    />
                  </div>

                  <div className="w-36 shrink-0">
                    <select
                      value={status.category}
                      onChange={(e) => handleStatusChange(idx, "category", e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-700 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs capitalize"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveStatus(idx)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded transition shrink-0"
                    title="Delete status"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Standard Workflow</span>
            </button>

            <div className="flex items-center gap-3">
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
                {saving ? "Saving..." : "Save Workflow"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

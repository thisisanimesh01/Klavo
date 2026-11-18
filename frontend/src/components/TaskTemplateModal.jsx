import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";
import { X, Plus, Trash2, LayoutTemplate } from "lucide-react";

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#8b5cf6", // purple
];

export default function TaskTemplateModal({
  open,
  onClose,
  projectId,
  teamId,
  onTemplateCreated,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultTitle, setDefaultTitle] = useState("");
  const [defaultDescription, setDefaultDescription] = useState("");
  const [defaultPriority, setDefaultPriority] = useState("medium");
  const [estimatedHours, setEstimatedHours] = useState("");

  // Labels
  const [labels, setLabels] = useState([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6366f1");

  // Checklist
  const [checklist, setChecklist] = useState([]);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Custom Fields
  const [customFields, setCustomFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const handleAddLabel = (e) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    setLabels([...labels, { name: newLabelName.trim(), color: newLabelColor }]);
    setNewLabelName("");
  };

  const handleRemoveLabel = (index) => {
    setLabels(labels.filter((_, i) => i !== index));
  };

  const handleAddChecklist = (e) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    setChecklist([...checklist, { text: newChecklistText.trim(), completed: false }]);
    setNewChecklistText("");
  };

  const handleRemoveChecklist = (index) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const handleAddCustomField = (e) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    setCustomFields([
      ...customFields,
      {
        name: newFieldName.trim(),
        type: newFieldType,
        value: newFieldType === "checkbox" ? false : "",
        options: newFieldType === "dropdown" ? ["Option 1", "Option 2"] : [],
      },
    ]);
    setNewFieldName("");
    setNewFieldType("text");
  };

  const handleRemoveCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        description: description.trim(),
        projectId: projectId || null,
        teamId: teamId || null,
        defaultTitle: defaultTitle.trim(),
        defaultDescription: defaultDescription.trim(),
        defaultPriority,
        defaultLabels: labels,
        defaultCustomFields: customFields,
        checklist,
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
      };

      const res = await axiosClient.post("/task-templates", payload);
      if (onTemplateCreated) onTemplateCreated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="app-card border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-2xl w-full max-w-xl shadow-2xl my-auto max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-lg">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Create Task Template
              </h2>
              <p className="text-xs text-slate-500">
                Define a reusable blueprint for rapid task creation
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
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Template Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Bug Report, Feature Spike, Security Audit"
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm focus:ring-2 focus:ring-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Template Purpose / Notes
            </label>
            <input
              type="text"
              placeholder="Brief description of when this blueprint is used"
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Default Title Prefix
              </label>
              <input
                type="text"
                placeholder="e.g. [BUG]: "
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm"
                value={defaultTitle}
                onChange={(e) => setDefaultTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Default Priority
              </label>
              <select
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={defaultPriority}
                onChange={(e) => setDefaultPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Default Description / Acceptance Criteria
            </label>
            <textarea
              rows={3}
              placeholder="## Description&#10;Describe steps to reproduce or acceptance criteria..."
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm"
              value={defaultDescription}
              onChange={(e) => setDefaultDescription(e.target.value)}
            />
          </div>

          {/* Labels Section */}
          <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
              Preset Labels
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {labels.map((lbl, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white shadow-sm"
                  style={{ backgroundColor: lbl.color }}
                >
                  {lbl.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveLabel(idx)}
                    className="hover:opacity-75"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Label name (e.g. Frontend)"
                className="flex-1 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg bg-transparent text-xs"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
              />
              <div className="flex items-center gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewLabelColor(c)}
                    className={`w-5 h-5 rounded-full border ${
                      newLabelColor === c ? "ring-2 ring-indigo-500 scale-110" : "opacity-80"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddLabel}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                Add
              </button>
            </div>
          </div>

          {/* Checklist Blueprint */}
          <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
              Default Checklist Items
            </label>
            <div className="space-y-1.5">
              {checklist.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span>☐ {item.text}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklist(idx)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Checklist step (e.g. Run test suite)"
                className="flex-1 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg bg-transparent text-xs"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddChecklist}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                Add Step
              </button>
            </div>
          </div>

          {/* Custom Fields Section */}
          <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
              Custom Fields
            </label>
            <div className="space-y-1.5">
              {customFields.map((cf, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {cf.name} <span className="text-slate-400 font-normal">({cf.type})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomField(idx)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Field name (e.g. Story Points, Environment)"
                className="flex-1 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg bg-transparent text-xs"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
              />
              <select
                className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs"
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value)}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="checkbox">Checkbox</option>
                <option value="dropdown">Dropdown</option>
              </select>
              <button
                type="button"
                onClick={handleAddCustomField}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                Add Field
              </button>
            </div>
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
              {saving ? "Creating..." : "Save Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

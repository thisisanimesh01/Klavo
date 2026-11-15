import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import CommentSection from "./CommentSection";
import PriorityBadge from "./PriorityBadge";
import { X, Plus, Trash2, LayoutTemplate, Tag, CheckSquare, Settings2, Clock } from "lucide-react";

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

export default function TaskModal({
  open,
  onClose,
  projectId,
  initialTask,     // if present -> edit
  defaultStatus,   // status for new task from column
  onSaved,
}) {
  const isEdit = Boolean(initialTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

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

  // Templates
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Load team members and templates for this project
  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const [membersRes, templatesRes] = await Promise.all([
          axiosClient.get(`/projects/${projectId}/members`),
          axiosClient.get(`/task-templates?projectId=${projectId}`),
        ]);
        setMembers(membersRes.data || []);
        setTemplates(templatesRes.data || []);
      } catch (err) {
        console.error("Failed to load project dependencies:", err);
      }
    };

    if (open && projectId) {
      fetchDependencies();
    }
  }, [open, projectId]);

  // Fill form in edit / create mode
  useEffect(() => {
    if (!open) return;

    if (isEdit && initialTask) {
      setTitle(initialTask.title || "");
      setDescription(initialTask.description || "");
      setStatus(initialTask.status || "todo");
      setPriority(initialTask.priority || "medium");
      setDueDate(
        initialTask.dueDate
          ? new Date(initialTask.dueDate).toISOString().split("T")[0]
          : ""
      );
      setEstimatedHours(initialTask.estimatedHours || "");
      setSelectedMembers(
        Array.isArray(initialTask.assignedTo)
          ? initialTask.assignedTo.map((u) => u._id)
          : []
      );
      setLabels(Array.isArray(initialTask.labels) ? initialTask.labels : []);
      setChecklist(Array.isArray(initialTask.checklist) ? initialTask.checklist : []);
      setCustomFields(Array.isArray(initialTask.customFields) ? initialTask.customFields : []);
      setSelectedTemplateId(initialTask.templateId?._id || initialTask.templateId || "");
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus || "todo");
      setPriority("medium");
      setDueDate("");
      setEstimatedHours("");
      setSelectedMembers([]);
      setLabels([]);
      setChecklist([]);
      setCustomFields([]);
      setSelectedTemplateId("");
    }
  }, [open, isEdit, initialTask, defaultStatus]);

  if (!open) return null;

  const handleApplyTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const tpl = templates.find((t) => t._id === templateId);
    if (!tpl) return;

    if (tpl.defaultTitle) setTitle(tpl.defaultTitle);
    if (tpl.defaultDescription) setDescription(tpl.defaultDescription);
    if (tpl.defaultPriority) setPriority(tpl.defaultPriority);
    if (tpl.estimatedHours !== null && tpl.estimatedHours !== undefined) {
      setEstimatedHours(tpl.estimatedHours);
    }
    if (tpl.defaultLabels?.length > 0) {
      setLabels(tpl.defaultLabels.map((l) => ({ name: l.name, color: l.color })));
    }
    if (tpl.defaultCustomFields?.length > 0) {
      setCustomFields(
        tpl.defaultCustomFields.map((cf) => ({
          name: cf.name,
          type: cf.type,
          value: cf.value || "",
          options: cf.options || [],
        }))
      );
    }
    if (tpl.checklist?.length > 0) {
      setChecklist(tpl.checklist.map((c) => ({ text: c.text, completed: false })));
    }
  };

  const handleToggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

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

  const handleToggleChecklist = (index) => {
    setChecklist(
      checklist.map((item, idx) =>
        idx === index ? { ...item, completed: !item.completed } : item
      )
    );
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

  const handleCustomFieldValueChange = (index, val) => {
    setCustomFields(
      customFields.map((cf, idx) => (idx === index ? { ...cf, value: val } : cf))
    );
  };

  const handleRemoveCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title,
        description,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
        assignedTo: selectedMembers,
        labels,
        checklist,
        customFields,
        templateId: selectedTemplateId || null,
      };

      let res;
      if (isEdit) {
        res = await axiosClient.put(`/tasks/${initialTask._id}`, payload);
      } else {
        res = await axiosClient.post("/tasks", {
          ...payload,
          projectId,
        });
      }

      onSaved && onSaved(res.data);
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to save task");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="app-card border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit Task" : "Create Task"}
            </h2>
            <p className="text-xs text-slate-500">
              Configure priorities, labels, blueprints, and custom fields
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Template Selector in Create Mode */}
          {!isEdit && templates.length > 0 && (
            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl">
              <label className="flex items-center gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase mb-1">
                <LayoutTemplate className="w-3.5 h-3.5" />
                Apply Task Template (Blueprint)
              </label>
              <select
                className="w-full border border-indigo-200 dark:border-indigo-800 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={selectedTemplateId}
                onChange={(e) => handleApplyTemplate(e.target.value)}
              >
                <option value="">None (Start from scratch)</option>
                {templates.map((tpl) => (
                  <option key={tpl._id} value={tpl._id}>
                    {tpl.name} ({tpl.defaultPriority})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Task Title *
            </label>
            <input
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Implement OIDC token exchange"
              value={title}
              required
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Description / Acceptance Criteria
            </label>
            <textarea
              className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm"
              rows={3}
              placeholder="Detailed specifications, references, or instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Core Controls: Status, Priority, Due Date, Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Status
              </label>
              <select
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="todo">Todo</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Priority
              </label>
              <select
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Due Date
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Est. Hours
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 4"
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-transparent text-sm"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
          </div>

          {/* Labels / Tags Section */}
          <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
              <Tag className="w-3.5 h-3.5" />
              Labels & Tags
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {labels.map((lbl, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white shadow-sm"
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
                placeholder="Add label (e.g. Frontend, Security)"
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

          {/* Checklist Items */}
          <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
              <CheckSquare className="w-3.5 h-3.5" />
              Checklist ({checklist.filter((i) => i.completed).length}/{checklist.length})
            </label>
            <div className="space-y-1.5">
              {checklist.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleChecklist(idx)}
                      className="rounded text-indigo-600"
                    />
                    <span className={item.completed ? "line-through text-slate-400" : ""}>
                      {item.text}
                    </span>
                  </label>
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
                placeholder="Checklist item (e.g. Write integration test)"
                className="flex-1 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg bg-transparent text-xs"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddChecklist}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                Add Item
              </button>
            </div>
          </div>

          {/* Dynamic Custom Fields */}
          <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
              <Settings2 className="w-3.5 h-3.5" />
              Custom Fields
            </label>
            <div className="space-y-2">
              {customFields.map((cf, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="font-semibold w-1/3 truncate text-slate-800 dark:text-slate-200">
                    {cf.name}
                  </span>
                  <div className="flex-1">
                    {cf.type === "checkbox" ? (
                      <input
                        type="checkbox"
                        checked={Boolean(cf.value)}
                        onChange={(e) => handleCustomFieldValueChange(idx, e.target.checked)}
                      />
                    ) : cf.type === "number" ? (
                      <input
                        type="number"
                        className="w-full border border-slate-300 dark:border-slate-700 px-2 py-1 rounded bg-white dark:bg-slate-900 text-xs"
                        value={cf.value || ""}
                        onChange={(e) => handleCustomFieldValueChange(idx, e.target.value)}
                      />
                    ) : cf.type === "date" ? (
                      <input
                        type="date"
                        className="w-full border border-slate-300 dark:border-slate-700 px-2 py-1 rounded bg-white dark:bg-slate-900 text-xs"
                        value={cf.value || ""}
                        onChange={(e) => handleCustomFieldValueChange(idx, e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        className="w-full border border-slate-300 dark:border-slate-700 px-2 py-1 rounded bg-white dark:bg-slate-900 text-xs"
                        value={cf.value || ""}
                        onChange={(e) => handleCustomFieldValueChange(idx, e.target.value)}
                      />
                    )}
                  </div>
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
                placeholder="Field name (e.g. Story Points)"
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

          {/* Multi-select members */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Assign to Team Members
            </label>
            {members.length === 0 ? (
              <div className="text-xs text-slate-500">
                No team members found.
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-1">
                {members.map((m) => (
                  <label
                    key={m._id}
                    className="flex items-center gap-2 text-sm p-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="rounded text-indigo-600"
                      checked={selectedMembers.includes(m._id)}
                      onChange={() => handleToggleMember(m._id)}
                    />
                    <span className="text-slate-800 dark:text-slate-200">
                      {m.name}{" "}
                      <span className="text-xs text-slate-400">
                        ({m.email})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition"
            >
              {isEdit ? "Update Task" : "Create Task"}
            </button>
          </div>
        </form>

        {/* Real-time Comments & Reactions in edit mode */}
        {isEdit && initialTask?._id && (
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
            <CommentSection taskId={initialTask._id} projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  );
}

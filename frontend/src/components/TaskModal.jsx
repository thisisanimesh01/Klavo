import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import CommentSection from "./CommentSection";
import PriorityBadge from "./PriorityBadge";
import {
  X,
  Plus,
  Trash2,
  LayoutTemplate,
  Tag,
  CheckSquare,
  Settings2,
  Clock,
  Zap,
  GitCommit,
  Link,
  ShieldAlert,
  CornerDownRight,
  CheckCircle2,
  FileText,
  BookOpen,
  ExternalLink,
} from "lucide-react";

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
  defaultSprintId, // default sprint if creating from sprint view
  defaultParentId, // if creating subtask
  workflow,
  onSaved,
}) {
  const isEdit = Boolean(initialTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [sprintId, setSprintId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [parentId, setParentId] = useState("");
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

  // Sprints & Project Tasks for dependency linking
  const [sprints, setSprints] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [availableDocs, setAvailableDocs] = useState([]);

  // Linked Documents (DOC-08)
  const [linkedDocs, setLinkedDocs] = useState([]);
  const [selectedDocIdToLink, setSelectedDocIdToLink] = useState("");

  // Dependencies
  const [dependencies, setDependencies] = useState([]);
  const [selectedDepTaskId, setSelectedDepTaskId] = useState("");
  const [selectedDepType, setSelectedDepType] = useState("blocked-by");

  // Subtasks
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Blocker warning message
  const [blockerError, setBlockerError] = useState(null);

  // Load team members, templates, sprints, and tasks for this project
  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const [membersRes, templatesRes, sprintsRes, tasksRes, docsRes, wikiRes] = await Promise.all([
          axiosClient.get(`/projects/${projectId}/members`),
          axiosClient.get(`/task-templates?projectId=${projectId}`),
          axiosClient.get(`/sprints/project/${projectId}`),
          axiosClient.get(`/tasks/project/${projectId}`),
          axiosClient.get(`/documents/project/${projectId}`),
          axiosClient.get(`/documents/wiki/project/${projectId}`),
        ]);
        setMembers(membersRes.data || []);
        setTemplates(templatesRes.data || []);
        setSprints(sprintsRes.data || []);
        setProjectTasks(tasksRes.data || []);

        // Combine project documents and wiki pages for linking
        const allDocs = [
          ...(docsRes.data || []),
          ...((wikiRes.data?.pages || []).map((w) => ({ ...w, isWiki: true }))),
        ];
        // Deduplicate by ID
        const docMap = new Map();
        allDocs.forEach((d) => docMap.set(d._id, d));
        setAvailableDocs(Array.from(docMap.values()));
      } catch (err) {
        console.error("Failed to load project dependencies:", err);
      }
    };

    if (open && projectId) {
      fetchDependencies();
    }
  }, [open, projectId]);

  // Load full task details (including subtasks and dependencies) if editing
  useEffect(() => {
    if (!open) return;

    if (isEdit && initialTask?._id) {
      const loadFullTask = async () => {
        try {
          const res = await axiosClient.get(`/tasks/${initialTask._id}`);
          const t = res.data;
          setTitle(t.title || "");
          setDescription(t.description || "");
          setStatus(t.status || "todo");
          setPriority(t.priority || "medium");
          setSprintId(t.sprintId?._id || t.sprintId || "");
          setMilestoneId(t.milestoneId?._id || t.milestoneId || "");
          setParentId(t.parentId?._id || t.parentId || "");
          setDueDate(t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "");
          setEstimatedHours(t.estimatedHours || "");
          setSelectedMembers(Array.isArray(t.assignedTo) ? t.assignedTo.map((u) => u._id) : []);
          setLabels(Array.isArray(t.labels) ? t.labels : []);
          setChecklist(Array.isArray(t.checklist) ? t.checklist : []);
          setCustomFields(Array.isArray(t.customFields) ? t.customFields : []);
          setSelectedTemplateId(t.templateId?._id || t.templateId || "");
          setDependencies(Array.isArray(t.dependencies) ? t.dependencies : []);
          setSubtasks(Array.isArray(t.subtasks) ? t.subtasks : []);

          // Load linked documents
          try {
            const linkedRes = await axiosClient.get(`/tasks/${initialTask._id}/documents`);
            setLinkedDocs(linkedRes.data || []);
          } catch (e) {
            console.error("Failed to load linked documents:", e);
          }
        } catch (err) {
          console.error("Failed to load task details:", err);
        }
      };
      loadFullTask();
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus || "todo");
      setPriority("medium");
      setSprintId(defaultSprintId || "");
      setParentId(defaultParentId || "");
      setDueDate("");
      setEstimatedHours("");
      setSelectedMembers([]);
      setLabels([]);
      setChecklist([]);
      setCustomFields([]);
      setSelectedTemplateId("");
      setDependencies([]);
      setSubtasks([]);
      setLinkedDocs([]);
    }
    setBlockerError(null);
  }, [open, isEdit, initialTask, defaultStatus, defaultSprintId, defaultParentId]);

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
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
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
      checklist.map((item, idx) => (idx === index ? { ...item, completed: !item.completed } : item))
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
    setCustomFields(customFields.map((cf, idx) => (idx === index ? { ...cf, value: val } : cf)));
  };

  const handleRemoveCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  // Dependency Management
  const handleAddDependency = async (e) => {
    e.preventDefault();
    if (!selectedDepTaskId) return;

    if (isEdit && initialTask?._id) {
      try {
        const res = await axiosClient.post(`/tasks/${initialTask._id}/dependencies`, {
          targetTaskId: selectedDepTaskId,
          type: selectedDepType,
        });
        setDependencies(res.data.dependencies || []);
        setSelectedDepTaskId("");
      } catch (err) {
        alert(err.response?.data?.message || "Failed to add dependency");
      }
    } else {
      // Create mode: stage locally
      const target = projectTasks.find((t) => t._id === selectedDepTaskId);
      setDependencies([
        ...dependencies,
        {
          taskId: target || { _id: selectedDepTaskId, title: "Selected Task" },
          type: selectedDepType,
        },
      ]);
      setSelectedDepTaskId("");
    }
  };

  const handleRemoveDependency = async (depTaskId) => {
    if (isEdit && initialTask?._id) {
      try {
        const res = await axiosClient.delete(
          `/tasks/${initialTask._id}/dependencies/${depTaskId}`
        );
        setDependencies(res.data.dependencies || []);
      } catch (err) {
        alert(err.response?.data?.message || "Failed to remove dependency");
      }
    } else {
      setDependencies(
        dependencies.filter((d) => (d.taskId?._id || d.taskId) !== depTaskId)
      );
    }
  };

  // Subtask Management
  const handleCreateSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !initialTask?._id) return;

    try {
      const res = await axiosClient.post("/tasks", {
        title: newSubtaskTitle.trim(),
        projectId,
        parentId: initialTask._id,
        status: "todo",
      });
      setSubtasks([...subtasks, res.data]);
      setNewSubtaskTitle("");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create subtask");
    }
  };

  const handleToggleSubtaskStatus = async (subtaskId, currentStatus) => {
    const doneStatus = workflow?.statuses?.find((s) => s.category === "done")?.key || "done";
    const todoStatus = workflow?.statuses?.find((s) => s.category === "todo")?.key || "todo";
    const isDone = workflow?.statuses?.find((s) => s.key === currentStatus)?.category === "done" || currentStatus === "done";
    const nextStatus = isDone ? todoStatus : doneStatus;
    try {
      const res = await axiosClient.put(`/tasks/${subtaskId}`, {
        status: nextStatus,
      });
      setSubtasks(subtasks.map((st) => (st._id === subtaskId ? res.data : st)));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update subtask");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBlockerError(null);
    try {
      const payload = {
        title,
        description,
        status,
        priority,
        sprintId: sprintId || null,
        milestoneId: milestoneId || null,
        parentId: parentId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
        assignedTo: selectedMembers,
        labels,
        checklist,
        customFields,
        templateId: selectedTemplateId || null,
        dependencies: dependencies.map((d) => ({
          taskId: d.taskId?._id || d.taskId,
          type: d.type,
        })),
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
      if (err.response?.data?.isBlocked) {
        setBlockerError(err.response.data.message);
      } else {
        alert(err.response?.data?.message || "Failed to save task");
      }
    }
  };

  const handleOverrideBlockersAndComplete = async () => {
    try {
      const res = await axiosClient.put(`/tasks/${initialTask._id}`, {
        status: "done",
        overrideBlockers: true,
      });
      onSaved && onSaved(res.data);
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to force complete task");
    }
  };

  // Handle Linking a Document or Wiki Page
  const handleLinkDocument = async () => {
    if (!selectedDocIdToLink || !initialTask?._id) return;
    try {
      await axiosClient.post(`/tasks/${initialTask._id}/documents/${selectedDocIdToLink}`);
      setSelectedDocIdToLink("");
      const updated = await axiosClient.get(`/tasks/${initialTask._id}/documents`);
      setLinkedDocs(updated.data || []);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to link document");
    }
  };

  // Handle Unlinking a Document
  const handleUnlinkDocument = async (docId) => {
    if (!initialTask?._id) return;
    try {
      await axiosClient.delete(`/tasks/${initialTask._id}/documents/${docId}`);
      setLinkedDocs((prev) => prev.filter((d) => d._id !== docId));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to unlink document");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="app-card border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-2xl w-full max-w-3xl shadow-2xl my-auto max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit Task" : "Create Task"}
            </h2>
            <p className="text-xs text-slate-500">
              Configure priorities, sprints, dependencies, subtasks, and custom fields
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Blocker alert if user tried to complete a blocked task */}
        {blockerError && (
          <div className="mt-4 p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Blocker Enforcement Warning</span>
            </div>
            <p>{blockerError}</p>
            <button
              type="button"
              onClick={handleOverrideBlockersAndComplete}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow-xs"
            >
              Override Blockers & Complete Anyway
            </button>
          </div>
        )}

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

          {/* Core Controls: Status, Priority, Sprint, Due Date, Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Status
              </label>
              <select
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {Array.isArray(workflow?.statuses) && workflow.statuses.length > 0 ? (
                  workflow.statuses.map((st) => (
                    <option key={st.key} value={st.key}>
                      {st.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="todo">Todo</option>
                    <option value="in-progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </>
                )}
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
                Sprint Iteration
              </label>
              <select
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
              >
                <option value="">Product Backlog (No Sprint)</option>
                {sprints.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Project Milestone
              </label>
              <select
                className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-sm"
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
              >
                <option value="">No Milestone Assigned</option>
                {milestones.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.status})
                  </option>
                ))}
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

          {/* Task Dependencies Section */}
          <div className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                <Link className="w-3.5 h-3.5 text-indigo-500" />
                Task Dependencies ({dependencies.length})
              </label>
              <span className="text-[11px] text-slate-400">
                Cycle detection active
              </span>
            </div>

            <div className="space-y-1.5">
              {dependencies.map((dep, idx) => {
                const target = dep.taskId || {};
                const isResolved = target.status === "done";
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          dep.type === "blocked-by"
                            ? isResolved
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300"
                            : dep.type === "blocks"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {dep.type}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {target.title || "Target Task"}
                      </span>
                      <span className="text-[10px] text-slate-400">({target.status || "open"})</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveDependency(target._id || target)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add Dependency Controls */}
            <div className="flex flex-wrap gap-2 pt-1">
              <select
                className="border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs font-medium"
                value={selectedDepType}
                onChange={(e) => setSelectedDepType(e.target.value)}
              >
                <option value="blocked-by">Blocked By (Predecessor)</option>
                <option value="blocks">Blocks (Successor)</option>
                <option value="relates-to">Relates To</option>
              </select>

              <select
                className="flex-1 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs"
                value={selectedDepTaskId}
                onChange={(e) => setSelectedDepTaskId(e.target.value)}
              >
                <option value="">Select task in project...</option>
                {projectTasks
                  .filter((t) => !isEdit || t._id !== initialTask?._id)
                  .map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.title} ({t.status})
                    </option>
                  ))}
              </select>

              <button
                type="button"
                onClick={handleAddDependency}
                disabled={!selectedDepTaskId}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition"
              >
                Link Task
              </button>
            </div>
          </div>

          {/* Linked Documents & Knowledge Base Articles Section (DOC-08) */}
          {isEdit && initialTask?._id && (
            <div className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 bg-slate-50/30 dark:bg-slate-900/30">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  Linked Documents & Knowledge Base ({linkedDocs.length})
                </label>
              </div>

              {linkedDocs.length > 0 ? (
                <div className="space-y-1.5">
                  {linkedDocs.map((doc) => (
                    <div
                      key={doc._id}
                      className="flex items-center justify-between text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        {doc.isWiki ? (
                          <span className="p-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                            <BookOpen className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="p-1 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <FileText className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {doc.title}
                        </span>
                        {doc.isWiki && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-semibold uppercase">
                            Wiki
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={doc.isWiki ? `/wiki/${projectId}/${doc._id}` : `/documents/${projectId}/${doc._id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium"
                          title="Open document in new tab"
                        >
                          Open
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleUnlinkDocument(doc._id)}
                          className="text-slate-400 hover:text-red-500 p-1"
                          title="Unlink document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No documents currently linked to this task.</p>
              )}

              {/* Link Document Controls */}
              <div className="flex gap-2 pt-1">
                <select
                  className="flex-1 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs"
                  value={selectedDocIdToLink}
                  onChange={(e) => setSelectedDocIdToLink(e.target.value)}
                >
                  <option value="">Choose document or wiki page to link...</option>
                  {availableDocs
                    .filter((d) => !linkedDocs.some((ld) => ld._id === d._id))
                    .map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.isWiki ? "📖 [Wiki] " : "📄 [Doc] "} {d.title}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleLinkDocument}
                  disabled={!selectedDocIdToLink}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                >
                  Link Document
                </button>
              </div>
            </div>
          )}

          {/* Subtasks Hierarchy Section (available in edit mode) */}
          {isEdit && initialTask?._id && (
            <div className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  <CornerDownRight className="w-3.5 h-3.5 text-indigo-500" />
                  Subtasks ({subtasks.filter((s) => s.status === "done").length}/{subtasks.length})
                </label>
              </div>

              <div className="space-y-1.5">
                {subtasks.map((st) => (
                  <div
                    key={st._id}
                    className="flex items-center justify-between text-xs p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg"
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1 truncate">
                      <input
                        type="checkbox"
                        checked={workflow?.statuses?.find((s) => s.key === st.status)?.category === "done" || st.status === "done"}
                        onChange={() => handleToggleSubtaskStatus(st._id, st.status)}
                        className="rounded text-indigo-600"
                      />
                      <span className={(workflow?.statuses?.find((s) => s.key === st.status)?.category === "done" || st.status === "done") ? "line-through text-slate-400 truncate" : "font-medium text-slate-800 dark:text-slate-200 truncate"}>
                        {st.title}
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="New subtask title..."
                  className="flex-1 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg bg-transparent text-xs"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleCreateSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50"
                >
                  Add Subtask
                </button>
              </div>
            </div>
          )}

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

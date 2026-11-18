import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { CheckSquare, ExternalLink, Trash2, X, Plus, AlertCircle, Clock } from "lucide-react";

export default function LinkedTasksDrawer({
  documentId,
  projectId,
  canEdit,
  isOpen,
  onClose,
}) {
  const [tasks, setTasks] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTaskIdToLink, setSelectedTaskIdToLink] = useState("");
  const [linking, setLinking] = useState(false);

  const fetchLinkedTasks = async () => {
    if (!documentId) return;
    try {
      setLoading(true);
      const res = await axiosClient.get(`/documents/${documentId}/tasks`);
      setTasks(res.data || []);
    } catch (err) {
      console.error("Failed to fetch linked tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTasks = async () => {
    if (!projectId) return;
    try {
      const res = await axiosClient.get(`/tasks/project/${projectId}`);
      setProjectTasks(res.data || []);
    } catch (err) {
      console.error("Failed to fetch project tasks:", err);
    }
  };

  useEffect(() => {
    if (isOpen && documentId) {
      fetchLinkedTasks();
      if (projectId) fetchProjectTasks();
    }
  }, [isOpen, documentId, projectId]);

  const handleLinkTask = async () => {
    if (!selectedTaskIdToLink || !documentId) return;
    try {
      setLinking(true);
      await axiosClient.post(`/tasks/${selectedTaskIdToLink}/documents/${documentId}`);
      setSelectedTaskIdToLink("");
      await fetchLinkedTasks();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to link task");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkTask = async (taskId) => {
    if (!taskId || !documentId) return;
    try {
      await axiosClient.delete(`/tasks/${taskId}/documents/${documentId}`);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to unlink task");
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed md:static inset-y-0 right-0 z-40 md:z-auto w-full sm:w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex flex-col shadow-2xl md:shadow-lg h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Linked Tasks ({tasks.length})
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="p-4 text-center text-xs text-slate-400">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700 stroke-[1.5]" />
            <p className="font-semibold text-slate-600 dark:text-slate-400 mb-1">
              No tasks linked
            </p>
            <p className="text-[11px]">
              Connect tasks to reference requirements, specs, and architectural decisions.
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task._id}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                  {task.title}
                </span>
                {canEdit && (
                  <button
                    onClick={() => handleUnlinkTask(task._id)}
                    className="text-slate-400 hover:text-red-500 p-0.5"
                    title="Unlink task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                  {task.status}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded font-medium text-white ${
                    task.priority === "urgent" || task.priority === "critical"
                      ? "bg-rose-500"
                      : task.priority === "high"
                      ? "bg-amber-500"
                      : "bg-indigo-500"
                  }`}
                >
                  {task.priority}
                </span>
                {task.dueDate && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="pt-1 flex justify-end">
                <a
                  href={`/kanban/${task.projectId || projectId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  View on Board
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Add Link */}
      {canEdit && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2">
          <label className="block text-[11px] font-semibold uppercase text-slate-500">
            Link Project Task
          </label>
          <div className="flex gap-2">
            <select
              value={selectedTaskIdToLink}
              onChange={(e) => setSelectedTaskIdToLink(e.target.value)}
              className="flex-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-950 focus:outline-none"
            >
              <option value="">Select task in project...</option>
              {projectTasks
                .filter((t) => !tasks.some((linked) => linked._id === t._id))
                .map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.title} ({t.status})
                  </option>
                ))}
            </select>
            <button
              onClick={handleLinkTask}
              disabled={!selectedTaskIdToLink || linking}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              Link
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

// frontend/src/components/TaskSidebar.jsx
import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";

/**
 * Props:
 * - open (bool)
 * - onClose (fn)
 * - taskId (string) // id of the task to load
 * - onTaskUpdated (fn) // callback with updated task to update Kanban state
 */
export default function TaskSidebar({ open, onClose, taskId, onTaskUpdated }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTask = async (id) => {
    try {
      setLoading(true);
      const res = await axiosClient.get(`/tasks/${id}`);
      setTask(res.data);
    } catch (err) {
      console.error("Fetch task failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && taskId) {
      fetchTask(taskId);
    } else {
      setTask(null);
    }
  }, [open, taskId]);

  const patchTask = async (patch) => {
    try {
      setSaving(true);
      const res = await axiosClient.put(`/tasks/${taskId}`, patch);
      setTask(res.data.task);
      if (onTaskUpdated) onTaskUpdated(res.data.task);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      setSaving(true);
      const res = await axiosClient.post(`/tasks/${taskId}/comment`, { text: commentText });
      setTask(res.data.task);
      setCommentText("");
      if (onTaskUpdated) onTaskUpdated(res.data.task);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* overlay */}
      <div className="absolute inset-0 bg-black opacity-30" onClick={onClose}></div>

      <div className="ml-auto relative w-full md:w-[480px] bg-white h-full shadow-xl overflow-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Task Details</h3>
          <button onClick={onClose} className="px-2 py-1 border rounded">Close</button>
        </div>

        {loading && <div className="p-4">Loading...</div>}

        {!loading && !task && <div className="p-4">Task not found.</div>}

        {!loading && task && (
          <div className="p-4 space-y-4">
            <div>
              <input
                className="w-full text-xl font-semibold border-b pb-2"
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                onBlur={() => patchTask({ title: task.title })}
              />
              <div className="text-sm text-slate-500 mt-1">Status:
                <select
                  className="ml-2 border px-2 py-1 rounded"
                  value={task.status}
                  onChange={(e) => patchTask({ status: e.target.value })}
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                rows={4}
                className="w-full border p-2 rounded mt-1"
                value={task.description || ""}
                onChange={(e) => setTask({ ...task, description: e.target.value })}
                onBlur={() => patchTask({ description: task.description })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Priority</label>
                <select
                  className="w-full border px-2 py-1 mt-1 rounded"
                  value={task.priority}
                  onChange={(e) => patchTask({ priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="text-sm">Due Date</label>
                <input
                  type="date"
                  className="w-full border px-2 py-1 mt-1 rounded"
                  value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => patchTask({ dueDate: e.target.value || null })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Assignee</label>
              <div className="mt-2">
                {task.assignee ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm">
                      {task.assignee.name?.slice(0,1) || "U"}
                    </div>
                    <div>
                      <div className="font-medium">{task.assignee.name}</div>
                      <div className="text-sm text-slate-500">{task.assignee.email}</div>
                    </div>
                    <button
                      className="ml-auto text-sm text-indigo-600"
                      onClick={() => patchTask({ assignee: "" })}
                    >
                      Unassign
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Not assigned</div>
                )}
              </div>
            </div>

            {/* Comments */}
            <div>
              <h4 className="font-medium">Comments</h4>
              <div className="mt-2 space-y-3">
                {task.comments && task.comments.length > 0 ? (
                  task.comments.slice().reverse().map((c) => (
                    <div key={c._id} className="p-3 bg-slate-50 rounded">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          {c.userId?.name || "Unknown"}
                        </div>
                        <div className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="text-sm text-slate-700 mt-1">{c.text}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No comments yet.</div>
                )}
              </div>

              <form onSubmit={submitComment} className="mt-3">
                <textarea
                  rows={3}
                  className="w-full border px-3 py-2 rounded"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded">
                    {saving ? "Saving..." : "Add Comment"}
                  </button>
                  <button type="button" onClick={() => setCommentText("")} className="px-4 py-2 border rounded">
                    Clear
                  </button>
                </div>
              </form>
            </div>

            <div className="text-sm text-slate-400">Last updated: {new Date(task.updatedAt).toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}

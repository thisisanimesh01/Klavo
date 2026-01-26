import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";

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

  const [members, setMembers] = useState([]); // team members list
  const [selectedMembers, setSelectedMembers] = useState([]); // array of userIds

  // Load team members for this project
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await axiosClient.get(`/projects/${projectId}/members`);
        setMembers(res.data || []);
      } catch (err) {
        console.error("Failed to load members:", err);
      }
    };

    if (open && projectId) {
      fetchMembers();
    }
  }, [open, projectId]);

  // Fill form in edit / create mode
  useEffect(() => {
    if (!open) return;

    if (isEdit && initialTask) {
      setTitle(initialTask.title || "");
      setDescription(initialTask.description || "");
      setStatus(initialTask.status || "todo");
      setSelectedMembers(
        Array.isArray(initialTask.assignedTo)
          ? initialTask.assignedTo.map((u) => u._id)
          : []
      );
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus || "todo");
      setSelectedMembers([]);
    }
  }, [open, isEdit, initialTask, defaultStatus]);

  if (!open) return null;

  const handleToggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title,
        description,
        status,
        assignedTo: selectedMembers,
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="app-card p-6 rounded-xl w-full max-w-md shadow">
        <h2 className="text-lg font-semibold mb-4">
          {isEdit ? "Edit Task" : "Create Task"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full border px-3 py-2 rounded bg-transparent"
            placeholder="Task title"
            value={title}
            required
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            className="w-full border px-3 py-2 rounded bg-transparent"
            rows={3}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <select
            className="w-full border px-3 py-2 rounded bg-transparent"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="todo">Todo</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>

          {/*  Multi-select members */}
          <div>
            <div className="text-sm font-medium mb-1">Assign to members</div>
            {members.length === 0 ? (
              <div className="text-xs text-slate-500">
                No team members found.
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto border rounded p-2 space-y-1">
                {members.map((m) => (
                  <label
                    key={m._id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(m._id)}
                      onChange={() => handleToggleMember(m._id)}
                    />
                    <span>
                      {m.name}{" "}
                      <span className="text-xs text-slate-500">
                        ({m.email})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button className="w-full bg-indigo-600 text-white py-2 rounded">
            {isEdit ? "Update Task" : "Create Task"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full border py-2 rounded mt-2"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

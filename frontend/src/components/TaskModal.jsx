import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";

export default function TaskModal({ open, onClose, projectId, initialData, onSuccess }) {
  const isEdit = Boolean(initialData);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
  });

  useEffect(() => {
    if (isEdit) {
      setForm({
        title: initialData.title,
        description: initialData.description,
        priority: initialData.priority,
        dueDate: initialData.dueDate ? initialData.dueDate.split("T")[0] : "",
      });
    }
  }, [initialData]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        const res = await axiosClient.put(`/tasks/${initialData._id}`, form);
        onSuccess(res.data.task);
      } else {
        const res = await axiosClient.post("/tasks", { ...form, projectId });
        onSuccess(res.data.task);
      }
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">{isEdit ? "Edit Task" : "Create Task"}</h2>

        <form className="space-y-4" onSubmit={submit}>
          <input
            className="w-full border px-3 py-2 rounded"
            placeholder="Task title"
            value={form.title}
            required
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <textarea
            className="w-full border px-3 py-2 rounded"
            placeholder="Description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <select
            className="w-full border px-3 py-2 rounded"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <input
            type="date"
            className="w-full border px-3 py-2 rounded"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />

          <button className="w-full bg-indigo-600 text-white py-2 rounded">
            {isEdit ? "Update Task" : "Create Task"}
          </button>

          <button type="button" onClick={onClose} className="w-full border py-2 rounded">
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

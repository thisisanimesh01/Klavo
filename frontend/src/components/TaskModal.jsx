import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";

export default function TaskModal({ open, onClose, projectId, initialData, onSuccess }) {
  const isEdit = Boolean(initialData);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    assignee: "",
    dueDate: "",
  });

  useEffect(() => {
    if (isEdit) {
      setForm({
        title: initialData.title || "",
        description: initialData.description || "",
        priority: initialData.priority || "medium",
        assignee: initialData.assignee?._id || "",
        dueDate: initialData.dueDate ? initialData.dueDate.split("T")[0] : "",
      });
    } else {
      setForm({
        title: "",
        description: "",
        priority: "medium",
        assignee: "",
        dueDate: "",
      });
    }
  }, [initialData, isEdit, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        const res = await axiosClient.put(`/tasks/${initialData._id}`, form);
        onSuccess(res.data.task);
      } else {
        const res = await axiosClient.post("/tasks", {
          ...form,
          projectId,
        });
        onSuccess(res.data.task);
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || err.message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center px-4 z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          {isEdit ? "Edit Task" : "Create Task"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full border px-3 py-2 rounded"
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({...form, title: e.target.value })}
            required
          />

          <textarea
            className="w-full border px-3 py-2 rounded"
            placeholder="Description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({...form, description: e.target.value })}
          />

          <div>
            <label className="text-sm">Priority</label>
            <select
              className="w-full border px-3 py-2 rounded mt-1"
              value={form.priority}
              onChange={(e) => setForm({...form, priority: e.target.value })}
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
              className="w-full border px-3 py-2 rounded mt-1"
              value={form.dueDate}
              onChange={(e) => setForm({...form, dueDate: e.target.value })}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded"
          >
            {isEdit ? "Update Task" : "Create Task"}
          </button>

          <button
            type="button"
            className="w-full border py-2 rounded mt-2"
            onClick={onClose}
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

// frontend/src/pages/Kanban.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskModal from "../components/TaskModal";
import ThemeToggle from "../components/ThemeToggle";
import ActivityPanel from "../components/ActivityPanel";

const COLUMNS = [
  { id: "todo", title: "Todo" },
  { id: "in-progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export default function Kanban() {
  const { projectId } = useParams();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [createStatus, setCreateStatus] = useState("todo");

  const [activeTab, setActiveTab] = useState("board"); // "board" | "activity"

  const fetchTasks = async () => {
    try {
      const res = await axiosClient.get(`/tasks/project/${projectId}`);
      setTasks(res.data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      fetchTasks();
    }
  }, [projectId]);

  const tasksByStatus = (status) =>
    tasks
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const ao = a.order ?? 0;
        const bo = b.order ?? 0;
        if (ao !== bo) return ao - bo;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const fromStatus = source.droppableId;
    const toStatus = destination.droppableId;
    if (fromStatus === toStatus && source.index === destination.index) return;

    try {
      await axiosClient.put(`/tasks/${draggableId}/move`, {
        status: toStatus,
        order: destination.index,
      });
      fetchTasks();
    } catch (err) {
      console.error("Failed to move task:", err);
      fetchTasks();
    }
  };

  const openCreateModal = (status) => {
    setEditingTask(null);
    setCreateStatus(status);
    setModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleTaskSaved = () => {
    fetchTasks();
  };

  const handleDeleteTask = async (id) => {
    if (!confirm("Delete this task?")) return;
    try {
      await axiosClient.delete(`/tasks/${id}`);
      fetchTasks();
    } catch (err) {
      console.error(err);
      alert("Failed to delete task");
    }
  };

  const renderAssignees = (task) => {
    if (!task.assignedTo || task.assignedTo.length === 0) return null;

    const names = task.assignedTo.map((u) => u.name).join(", ");
    return (
      <div className="mt-2 text-xs text-slate-500">
        Assigned: {names.length > 40 ? names.slice(0, 40) + "..." : names}
      </div>
    );
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen app-bg p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Kanban</h1>
          <ThemeToggle />
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b">
          <button
            className={`px-4 py-2 text-sm ${
              activeTab === "board"
                ? "border-b-2 border-indigo-600 font-medium"
                : "text-slate-500"
            }`}
            onClick={() => setActiveTab("board")}
          >
            Board
          </button>
          <button
            className={`px-4 py-2 text-sm ${
              activeTab === "activity"
                ? "border-b-2 border-indigo-600 font-medium"
                : "text-slate-500"
            }`}
            onClick={() => setActiveTab("activity")}
          >
            Activity
          </button>
        </div>

        {activeTab === "board" ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLUMNS.map((col) => (
                <Droppable droppableId={col.id} key={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`app-card rounded-xl p-4 min-h-[300px] shadow-sm transition 
                        ${snapshot.isDraggingOver ? "ring-2 ring-indigo-300" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="font-semibold">{col.title}</h2>
                        <button
                          className="text-sm text-indigo-600"
                          onClick={() => openCreateModal(col.id)}
                        >
                          + Add
                        </button>
                      </div>

                      {tasksByStatus(col.id).map((task, index) => (
                        <Draggable
                          key={task._id}
                          draggableId={task._id}
                          index={index}
                        >
                          {(providedDraggable, snapshotDraggable) => (
                            <div
                              ref={providedDraggable.innerRef}
                              {...providedDraggable.draggableProps}
                              {...providedDraggable.dragHandleProps}
                              className={`mb-3 p-3 rounded-lg border cursor-pointer 
                                bg-white/90 dark:bg-slate-900 transition 
                                ${
                                  snapshotDraggable.isDragging
                                    ? "shadow-lg"
                                    : "shadow-sm"
                                }`}
                              onClick={() => openEditModal(task)}
                            >
                              <div className="font-medium">{task.title}</div>

                              {task.description && (
                                <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                                  {task.description}
                                </div>
                              )}

                              {renderAssignees(task)}

                              <button
                                className="mt-2 text-xs text-red-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task._id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}

                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        ) : (
          <ActivityPanel projectId={projectId} />
        )}
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        initialTask={editingTask}
        defaultStatus={createStatus}
        onSaved={handleTaskSaved}
      />
    </div>
  );
}

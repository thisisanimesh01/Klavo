import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskModal from "../components/TaskModal";
import ThemeToggle from "../components/ThemeToggle";
import ActivityPanel from "../components/ActivityPanel";
import ChatPanel from "../components/ChatPanel";
import socket from "../socket";

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

  const [activeTab, setActiveTab] = useState("board");

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get(`/tasks/project/${projectId}`);
      setTasks(res.data || []);
    } catch {}
    finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchTasks();
  }, [projectId, fetchTasks]);

  useEffect(() => {
    if (!projectId) return;
    if (!socket.connected) socket.connect();

    socket.emit("joinProject", { projectId });

    const created = (task) => {
      if (String(task.projectId) === String(projectId)) {
        setTasks((prev) =>
          prev.some((t) => t._id === task._id) ? prev : [...prev, task]
        );
      }
    };

    const updated = (task) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    };

    const moved = (task) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    };

    const deleted = ({ _id }) => {
      setTasks((prev) => prev.filter((t) => t._id !== _id));
    };

    socket.on("taskCreated", created);
    socket.on("taskUpdated", updated);
    socket.on("taskMoved", moved);
    socket.on("taskDeleted", deleted);

    return () => {
      socket.emit("leaveProject", { projectId });
      socket.off("taskCreated", created);
      socket.off("taskUpdated", updated);
      socket.off("taskMoved", moved);
      socket.off("taskDeleted", deleted);
    };
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
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    try {
      await axiosClient.put(`/tasks/${draggableId}/move`, {
        status: destination.droppableId,
        order: destination.index,
      });
      fetchTasks();
    } catch {
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
    setModalOpen(false);
  };

  const deleteTask = async (id) => {
    if (!confirm("Delete this task?")) return;
    await axiosClient.delete(`/tasks/${id}`);
  };

  const renderAssignees = (task) => {
    if (!task.assignedTo?.length) return null;
    return (
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">
        Assigned: {task.assignedTo.map((u) => u.name).join(", ")}
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

        <div className="flex gap-2 mb-4 border-b">
          {["board", "activity", "chat"].map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 text-sm ${
                activeTab === tab
                  ? "border-b-2 border-indigo-600 font-medium"
                  : "text-slate-500"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "board" && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLUMNS.map((col) => (
                <Droppable key={col.id} droppableId={col.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="app-card rounded-xl p-4 min-h-[300px] shadow-sm"
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
                          {(prov) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className="mb-3 p-3 rounded-lg border bg-white dark:bg-slate-900 cursor-pointer"
                            >
                              <div
                                onClick={() => openEditModal(task)}
                                className="font-medium"
                              >
                                {task.title}
                              </div>

                              {renderAssignees(task)}

                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => deleteTask(task._id)}
                                  className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                                >
                                  Delete
                                </button>
                              </div>
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
        )}

        {activeTab === "activity" && <ActivityPanel projectId={projectId} />}
        {activeTab === "chat" && <ChatPanel projectId={projectId} />}
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

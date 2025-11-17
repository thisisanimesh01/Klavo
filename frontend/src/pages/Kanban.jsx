// frontend/src/pages/Kanban.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { io } from "socket.io-client";
import TaskModal from "../components/TaskModal";
import TaskSidebar from "../components/TaskSidebar";

const COLUMN_ORDER = ["todo", "in-progress", "review", "done"];
const COLUMN_LABEL = {
  "todo": "To Do",
  "in-progress": "In Progress",
  "review": "Review",
  "done": "Done"
};

function TaskCard({ task }) {
  return (
    <div className="p-3 bg-white rounded shadow-sm border">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-medium">{task.title}</div>
          {task.assignee && <div className="text-xs text-slate-500">{task.assignee.name}</div>}
        </div>
        <div className="text-xs px-2 py-1 rounded text-white bg-slate-400">{task.priority}</div>
      </div>
      {task.dueDate && (
        <div className="mt-2 text-xs text-slate-500">Due: {new Date(task.dueDate).toLocaleDateString()}</div>
      )}
    </div>
  );
}

export default function Kanban() {
  const { projectId } = useParams();
  const [columns, setColumns] = useState({
    todo: [],
    "in-progress": [],
    review: [],
    done: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Modal & Sidebar states
  const [openModal, setOpenModal] = useState(false);
  const [modalModeStatus, setModalModeStatus] = useState(null);
  const [editTaskData, setEditTaskData] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);

  const socketRef = useRef(null);

  // Real-time socket (connect once)
  useEffect(() => {
    const socketUrl = "http://localhost:5050"; // backend URL
    const socket = io(socketUrl, { transports: ["websocket"], withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));

    socket.on("task-updated", (payload) => {
      if (!payload) return;
      if (String(payload.projectId) !== String(projectId)) return;
      // re-fetch tasks to sync
      fetchTasks();
    });

    socket.on("task-commented", (payload) => {
      if (!payload) return;
      if (String(payload.projectId) !== String(projectId)) return;
      fetchTasks();
      // if sidebar open for same task, re-fetch that too
      if (payload.taskId && payload.taskId === activeTaskId) {
        // sidebar will fetch by effect because activeTaskId unchanged; to force, we can setActiveTaskId(null) then set again, but simpler: call fetchTaskInSidebar via ref?
        // Sidebar fetches on open or activeTaskId change; we rely on sidebar to show updated comments after user action
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, activeTaskId]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axiosClient.get(`/tasks/project/${projectId}`);
      const tasks = res.data || [];

      const grouped = { todo: [], "in-progress": [], review: [], done: [] };
      tasks.forEach(t => {
        grouped[t.status] = grouped[t.status] || [];
        grouped[t.status].push(t);
      });

      setColumns(grouped);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchTasks();
  }, [projectId, fetchTasks]);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index)
      return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    const task = columns[sourceCol].find(t => String(t._id) === draggableId);
    if (!task) return;

    // Optimistic UI update
    const newColumns = { ...columns };
    newColumns[sourceCol] = Array.from(newColumns[sourceCol]);
    newColumns[sourceCol].splice(source.index, 1);
    newColumns[destCol] = Array.from(newColumns[destCol]);
    newColumns[destCol].splice(destination.index, 0, { ...task, status: destCol });
    setColumns(newColumns);

    try {
      await axiosClient.put(`/tasks/${draggableId}/move`, { status: destCol });
      // backend emits event -> fetchTasks will sync
    } catch (err) {
      fetchTasks();
      console.error("Move failed:", err.response?.data || err.message);
    }
  };

  const openCreateModal = (status) => {
    setEditTaskData(null);
    setModalModeStatus(status);
    setOpenModal(true);
  };

  const openEditModal = (task) => {
    setEditTaskData(task);
    setModalModeStatus(null);
    setOpenModal(true);
  };

  // NEW: open sidebar on single-click
  const openSidebarForTask = (taskId) => {
    setActiveTaskId(taskId);
    setSidebarOpen(true);
  };

  // callback from sidebar when a task is updated (save -> update kanban lists)
  const handleTaskUpdated = (updatedTask) => {
    setColumns(prev => {
      const newCols = { ...prev };
      // remove task from all columns
      Object.keys(newCols).forEach(col => {
        newCols[col] = newCols[col].filter(t => String(t._id) !== String(updatedTask._id));
      });
      // add to its status column
      newCols[updatedTask.status] = [...(newCols[updatedTask.status] || []), updatedTask];
      return newCols;
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Kanban Board</h2>
          <div className="text-sm text-slate-500">{socketConnected ? "Live" : "Offline"}</div>
        </header>

        {loading && <div className="p-4">Loading tasks...</div>}
        {error && <div className="p-4 text-red-600">{error}</div>}

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {COLUMN_ORDER.map((colId) => (
              <Droppable droppableId={colId} key={colId}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`bg-white p-4 rounded shadow min-h-[300px] ${snapshot.isDraggingOver ? "ring-2 ring-indigo-300" : ""}`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold">{COLUMN_LABEL[colId]}</h3>
                      <button
                        onClick={() => openCreateModal(colId)}
                        className="text-sm text-indigo-600"
                      >
                        + Add Task
                      </button>
                    </div>

                    <div className="space-y-3">
                      {columns[colId]?.map((task, index) => (
                        <Draggable draggableId={String(task._id)} index={index} key={task._id}>
                          {(providedDraggable, snapshotDraggable) => (
                            <div
                              ref={providedDraggable.innerRef}
                              {...providedDraggable.draggableProps}
                              {...providedDraggable.dragHandleProps}
                              className={`transition ${snapshotDraggable.isDragging ? "scale-[1.02] shadow-lg" : ""}`}
                            >
                              <div onClick={() => openSidebarForTask(task._id)} onDoubleClick={() => openEditModal(task)}>
                                <TaskCard task={task} />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}

                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* create/edit modal */}
      <TaskModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        projectId={projectId}
        initialData={editTaskData}
        onSuccess={(task) => {
          // add to column
          setColumns(prev => {
            const newCols = { ...prev };
            Object.keys(newCols).forEach(col => {
              newCols[col] = newCols[col].filter(t => String(t._id) !== String(task._id));
            });
            newCols[task.status] = [...(newCols[task.status] || []), task];
            return newCols;
          });
        }}
      />

      {/* Task Sidebar */}
      <TaskSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        taskId={activeTaskId}
        onTaskUpdated={handleTaskUpdated}
      />
    </div>
  );
}

import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import PriorityBadge from "../components/PriorityBadge";
import { Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default function Calendar() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCalendarTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await axiosClient.get("/calendar");
        setTasks(data || []);
      } catch (err) {
        console.error("Failed to load calendar tasks:", err);
        setError(err.response?.data?.message || "Failed to load calendar tasks.");
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarTasks();
  }, []);

  const getStatusBadge = (status) => {
    const styles = {
      done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      "in-progress": "bg-blue-500/10 text-blue-400 border-blue-500/20",
      review: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      todo: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.todo}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <CalendarIcon className="text-indigo-600 dark:text-indigo-400" size={28} />
            My Calendar & Due Dates
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            Upcoming deadlines and priority schedules for tasks assigned to you.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 app-card">
          <CalendarIcon className="mx-auto text-slate-400 mb-3" size={48} />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">No Scheduled Deadlines</h3>
          <p className="text-sm mt-1 text-slate-500">
            You have no assigned tasks with approaching due dates.
          </p>
        </div>
      )}

      {!loading && !error && tasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => {
            const dueDate = task.dueDate ? new Date(task.dueDate) : null;
            const isOverdue = dueDate && dueDate < new Date() && task.status !== "done";

            return (
              <div
                key={task._id}
                className={`p-5 rounded-xl border transition shadow-sm hover:shadow app-card ${
                  isOverdue ? "border-red-400/80 bg-red-50/20 dark:bg-red-950/20" : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-base line-clamp-1 text-slate-900 dark:text-white">
                    {task.title}
                  </h3>
                  <PriorityBadge priority={task.priority} />
                </div>

                {task.description && (
                  <p className="text-sm mb-4 line-clamp-2 text-slate-600 dark:text-slate-400">
                    {task.description}
                  </p>
                )}

                {task.labels?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {task.labels.map((lbl, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] font-medium text-white shadow-xs"
                        style={{ backgroundColor: lbl.color || "#6366f1" }}
                      >
                        {lbl.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className={`flex items-center gap-1.5 ${isOverdue ? "text-red-500 font-semibold" : "text-slate-400"}`}>
                    <Clock size={14} />
                    <span>{dueDate ? dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No date"}</span>
                    {isOverdue && <span className="text-[10px] uppercase font-bold">(Overdue)</span>}
                  </div>
                  <div>{getStatusBadge(task.status)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

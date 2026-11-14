import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
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

  const getPriorityBadge = (priority) => {
    const styles = {
      critical: "bg-red-500/10 text-red-400 border-red-500/20",
      high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      medium: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      low: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[priority] || styles.medium}`}>
        {priority}
      </span>
    );
  };

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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="text-indigo-400" size={28} />
            My Calendar & Due Dates
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Upcoming deadlines for tasks assigned to you.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div
          className="p-12 text-center rounded-2xl border"
          style={{ background: "var(--bg-card)", borderColor: "var(--card-border)" }}
        >
          <CalendarIcon className="mx-auto text-slate-500 mb-3" size={48} />
          <h3 className="text-lg font-semibold">No Scheduled Deadlines</h3>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
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
                className="p-5 rounded-xl border transition shadow-sm hover:shadow"
                style={{
                  background: "var(--bg-card)",
                  borderColor: isOverdue ? "rgba(239, 68, 68, 0.4)" : "var(--card-border)",
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-base line-clamp-1">{task.title}</h3>
                  {getPriorityBadge(task.priority)}
                </div>

                {task.description && (
                  <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                    {task.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs pt-3 border-t" style={{ borderColor: "var(--card-border)" }}>
                  <div className={`flex items-center gap-1.5 ${isOverdue ? "text-red-400 font-semibold" : "text-slate-400"}`}>
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

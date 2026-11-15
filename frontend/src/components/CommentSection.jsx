import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";
import socket from "../socket";
import ReactionGroup from "./ReactionGroup";

export default function CommentSection({ taskId, projectId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchComments = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/comments/${taskId}`);
        if (isMounted) setComments(res.data || []);
      } catch (err) {
        console.error("Failed to load comments:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (taskId) {
      fetchComments();
      socket.emit("joinCommentThread", taskId);
    }

    const handleCommentAdded = (comment) => {
      if (comment.taskId === taskId) {
        setComments((prev) => {
          if (prev.some((c) => c._id === comment._id)) return prev;
          return [...prev, comment];
        });
      }
    };

    socket.on("commentAdded", handleCommentAdded);

    return () => {
      isMounted = false;
      if (taskId) socket.emit("leaveCommentThread", taskId);
      socket.off("commentAdded", handleCommentAdded);
    };
  }, [taskId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    try {
      setSubmitting(true);
      const res = await axiosClient.post(`/comments/${taskId}`, { text: text.trim() });
      setComments((prev) => {
        if (prev.some((c) => c._id === res.data._id)) return prev;
        return [...prev, res.data];
      });
      setText("");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-slate-800 dark:text-slate-100">
        Comments ({comments.length})
      </h4>

      {loading && <div className="text-xs text-slate-400">Loading comments...</div>}

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {!loading && comments.length === 0 && (
          <div className="text-xs text-slate-400 italic">No comments yet.</div>
        )}

        {comments.map((c) => (
          <div
            key={c._id}
            className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {c.userId?.name || "Unknown"}
              </span>
              <span className="text-[10px] text-slate-400">
                {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-wrap">
              {c.text}
            </p>
            <ReactionGroup commentId={c._id} projectId={projectId} />
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
        <input
          type="text"
          placeholder="Add a comment or @mention..."
          className="flex-1 text-xs border rounded-lg px-3 py-2 bg-transparent dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="text-xs px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {submitting ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}

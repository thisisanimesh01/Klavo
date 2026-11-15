import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";
import socket from "../socket";

const EMOJI_OPTIONS = ["👍", "❤️", "🎉", "🚀", "👀", "🔥"];

export default function ReactionGroup({ commentId, projectId }) {
  const [reactions, setReactions] = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchReactions = async () => {
      try {
        const res = await axiosClient.get(`/reactions/${commentId}`);
        if (isMounted) setReactions(res.data || []);
      } catch (err) {
        // Silently handle if not supported or network error
      }
    };

    if (commentId) fetchReactions();

    const handleAdded = (newReaction) => {
      if (newReaction.commentId === commentId) {
        setReactions((prev) => {
          if (prev.some((r) => r._id === newReaction._id)) return prev;
          return [...prev, newReaction];
        });
      }
    };

    const handleRemoved = ({ commentId: cId, userId, emoji }) => {
      if (cId === commentId) {
        setReactions((prev) =>
          prev.filter((r) => !(r.emoji === emoji && (r.userId?._id === userId || r.userId === userId)))
        );
      }
    };

    socket.on("reactionAdded", handleAdded);
    socket.on("reactionRemoved", handleRemoved);

    return () => {
      isMounted = false;
      socket.off("reactionAdded", handleAdded);
      socket.off("reactionRemoved", handleRemoved);
    };
  }, [commentId]);

  // Aggregate reactions by emoji
  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const handleAddReaction = async (emoji) => {
    try {
      setShowPicker(false);
      await axiosClient.post(`/reactions/${commentId}`, { emoji });
    } catch (err) {
      if (err.response?.status !== 409) {
        console.error("Failed to add reaction:", err);
      }
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      {Object.entries(grouped).map(([emoji, count]) => (
        <span
          key={emoji}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
        >
          <span>{emoji}</span>
          <span className="text-slate-500 dark:text-slate-400">{count}</span>
        </span>
      ))}

      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs px-1.5 py-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded border border-transparent hover:border-slate-200"
          title="Add reaction"
        >
          +😀
        </button>

        {showPicker && (
          <div className="absolute left-0 bottom-full mb-1 z-50 flex gap-1 p-1.5 bg-white dark:bg-slate-800 border rounded-lg shadow-lg">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAddReaction(emoji)}
                className="hover:scale-125 transition-transform p-1 text-base leading-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

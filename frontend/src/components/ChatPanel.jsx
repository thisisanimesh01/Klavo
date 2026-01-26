import React, { useEffect, useState, useRef } from "react";
import axiosClient from "../api/axiosClient";
import { useSelector } from "react-redux";
import socket from "../socket";

export default function ChatPanel({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const { user } = useSelector((state) => state.auth);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Load initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/messages/${projectId}`);
        setMessages(res.data || []);
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      }
    };

    if (projectId) {
      fetchMessages();
    }
  }, [projectId]);

  // Socket: listen for new chat messages
  useEffect(() => {
    if (!projectId) return;

    if (!socket.connected) {
      socket.connect();
    }

    const handleChatMessage = (msg) => {
      if (String(msg.projectId) !== String(projectId)) return;
      setMessages((prev) => [...prev, msg]);
      setTimeout(scrollToBottom, 50);
    };

    socket.on("chatMessage", handleChatMessage);

    return () => {
      socket.off("chatMessage", handleChatMessage);
    };
  }, [projectId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !projectId || !user) return;

    try {
      setSending(true);
      await axiosClient.post(`/messages/${projectId}`, {
        text: input.trim(),
      });
      setInput("");
      // We don't manually push to messages here because
      // the backend will emit "chatMessage" and the listener will update.
    } catch (err) {
      console.error("Send message failed:", err);
      alert(err.response?.data?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isMine = (msg) =>
    user && msg.user && String(msg.user._id) === String(user._id);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] app-bg rounded-xl border border-slate-800">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center text-slate-400 mt-6">Loading chat…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-500 mt-10 text-sm">
            💬 No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg._id}
              className={`flex ${
                isMine(msg) ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs md:max-w-md px-3 py-2 rounded-2xl text-sm shadow-sm
                  ${
                    isMine(msg)
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-slate-700 text-slate-50 rounded-bl-sm"
                  }`}
              >
                {!isMine(msg) && (
                  <div className="text-[11px] text-slate-300 mb-0.5">
                    {msg.user?.name || "Unknown"}
                  </div>
                )}
                <div>{msg.text}</div>
                <div
                  className={`text-[10px] mt-1 ${
                    isMine(msg)
                      ? "text-blue-100/80 text-right"
                      : "text-slate-300/80 text-right"
                  }`}
                >
                  {formatTime(msg.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSend}
        className="border-t border-slate-800 p-3 flex items-center gap-2"
      >
        <input
          type="text"
          className="flex-1 px-3 py-2 rounded-full bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}

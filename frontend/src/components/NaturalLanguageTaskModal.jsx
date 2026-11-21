import React, { useState } from "react";
import { Sparkles, Loader2, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import aiApi from "../api/aiApi";

export default function NaturalLanguageTaskModal({
  isOpen,
  onClose,
  projectId,
  onTaskParsed,
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parsedTask, setParsedTask] = useState(null);

  if (!isOpen) return null;

  const handleExtract = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError("");
    setParsedTask(null);

    try {
      const res = await aiApi.extractTask(prompt.trim(), projectId);
      if (res.data?.extractedTask) {
        setParsedTask(res.data.extractedTask);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process prompt. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (parsedTask && onTaskParsed) {
      onTaskParsed(parsedTask);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nl-task-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl p-6 transition-all"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--card-border)",
          color: "var(--text-main)",
        }}
      >
        <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 id="nl-task-title" className="text-base font-semibold">
                AI Task Creator
              </h3>
              <p className="text-xs text-slate-400">Describe what needs to be done in plain English</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleExtract} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Task Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Set up Redis cluster with TLS by next Friday #infrastructure #backend Priority is high with 8 hours estimate."
              rows={4}
              className="w-full p-3 rounded-xl border text-sm resize-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
              style={{
                background: "var(--bg-main)",
                borderColor: "var(--card-border)",
                color: "var(--text-main)",
              }}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              style={{ borderColor: "var(--card-border)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Extract Fields
                </>
              )}
            </button>
          </div>
        </form>

        {parsedTask && (
          <div className="mt-5 p-4 rounded-xl border space-y-3 bg-indigo-500/5 border-indigo-500/20 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Extracted Task Preview
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 uppercase font-mono">
                {parsedTask.priority}
              </span>
            </div>

            <div>
              <div id="ai-preview-task-title" className="text-sm font-semibold text-slate-200">{parsedTask.title}</div>
              {parsedTask.description && (
                <div className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{parsedTask.description}</div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
              {parsedTask.dueDate && (
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                  📅 {new Date(parsedTask.dueDate).toLocaleDateString()}
                </span>
              )}
              {parsedTask.estimatedHours && (
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                  ⏱ {parsedTask.estimatedHours} hrs
                </span>
              )}
              {parsedTask.labels?.map((l, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                  #{l.name}
                </span>
              ))}
            </div>

            {parsedTask.checklist?.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-medium text-slate-400">Checklist ({parsedTask.checklist.length}):</span>
                {parsedTask.checklist.map((item, idx) => (
                  <div key={idx} className="text-xs text-slate-300 flex items-center gap-1.5">
                    <span className="text-slate-500">•</span> {item.text}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                id="btn-use-extracted-task"
                onClick={handleApply}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus size={14} />
                Use Extracted Task
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

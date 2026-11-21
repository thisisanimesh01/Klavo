import React, { useState, useEffect } from "react";
import { Sparkles, TrendingUp, AlertTriangle, ArrowUpDown, MessageSquare, Loader2, X, RefreshCw } from "lucide-react";
import aiApi from "../api/aiApi";

export default function AIProjectInsightsDrawer({
  isOpen,
  onClose,
  projectId,
  projectName = "Current Project",
}) {
  const [activeTab, setActiveTab] = useState("summary"); // "summary" | "risks" | "prioritize" | "qa"
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [risksData, setRisksData] = useState(null);
  const [prioritizeData, setPrioritizeData] = useState(null);

  // Q&A State
  const [question, setQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    if (isOpen && projectId) {
      loadTabData(activeTab);
    }
  }, [isOpen, projectId, activeTab]);

  const loadTabData = async (tab) => {
    if (!projectId) return;
    setLoading(true);
    try {
      if (tab === "summary") {
        const res = await aiApi.getProjectSummary(projectId);
        setSummaryData(res.data);
      } else if (tab === "risks") {
        const res = await aiApi.getProjectRisks(projectId);
        setRisksData(res.data);
      } else if (tab === "prioritize") {
        const res = await aiApi.getPrioritizationRecommendations(projectId);
        setPrioritizeData(res.data);
      }
    } catch (err) {
      console.error(`Failed to load AI ${tab}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim() || qaLoading) return;

    const userQ = question.trim();
    setChatMessages((prev) => [...prev, { sender: "user", text: userQ }]);
    setQuestion("");
    setQaLoading(true);

    try {
      const res = await aiApi.askQuestion(projectId, userQ);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: res.data?.answer || "No response received.",
          sources: res.data?.sources || [],
        },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Failed to answer query. Please ensure project records are accessible." },
      ]);
    } finally {
      setQaLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] border-l shadow-2xl flex flex-col transition-transform animate-slide-left"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--card-border)",
        color: "var(--text-main)",
      }}
      role="dialog"
      aria-label="AI Project Insights Drawer"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI Project Advisor</h3>
            <p className="text-xs text-slate-400">{projectName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => loadTabData(activeTab)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Refresh AI insights"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            aria-label="Close drawer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b text-xs font-medium" style={{ borderColor: "var(--card-border)" }}>
        {[
          { key: "summary", label: "Progress", icon: TrendingUp },
          { key: "risks", label: "Risks", icon: AlertTriangle },
          { key: "prioritize", label: "Prioritize", icon: ArrowUpDown },
          { key: "qa", label: "Q&A", icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition ${
                isActive
                  ? "border-indigo-500 text-indigo-400 font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs gap-2">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
            <span>Analyzing project intelligence...</span>
          </div>
        ) : (
          <>
            {/* Tab 1: Progress Summary */}
            {activeTab === "summary" && summaryData && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl border bg-slate-900/40" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">Completion Velocity</span>
                    <span className="text-sm font-bold text-indigo-400">{summaryData.completionRate}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs pt-2 border-t border-slate-800">
                    <div>
                      <div className="text-slate-400 text-[10px]">Total</div>
                      <div className="font-semibold text-slate-200">{summaryData.metrics?.total || 0}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Done</div>
                      <div className="font-semibold text-emerald-400">{summaryData.metrics?.completed || 0}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Doing</div>
                      <div className="font-semibold text-amber-400">{summaryData.metrics?.inProgress || 0}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Overdue</div>
                      <div className="font-semibold text-red-400">{summaryData.metrics?.overdue || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-indigo-500/5 border-indigo-500/20">
                  <div className="text-xs font-semibold text-indigo-300 mb-1">Executive Summary</div>
                  <p className="text-xs text-slate-300 leading-relaxed">{summaryData.summary}</p>
                </div>

                {summaryData.actionableInsights?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">Actionable Recommendations</div>
                    {summaryData.actionableInsights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border text-xs text-slate-300 flex items-start gap-2 bg-slate-900/30"
                        style={{ borderColor: "var(--card-border)" }}
                      >
                        <span className="text-indigo-400 font-bold">•</span>
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Risks & Blockers */}
            {activeTab === "risks" && risksData && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-900/40" style={{ borderColor: "var(--card-border)" }}>
                  <span className="text-xs font-semibold text-slate-300">Overall Risk Posture</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full uppercase font-mono font-semibold ${
                    risksData.riskScore === "critical" ? "bg-red-500/20 text-red-400" :
                    risksData.riskScore === "medium" ? "bg-amber-500/20 text-amber-400" :
                    "bg-emerald-500/20 text-emerald-400"
                  }`}>
                    {risksData.riskScore}
                  </span>
                </div>

                {risksData.risks?.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No active risks detected. Project delivery is on track!
                  </div>
                ) : (
                  risksData.risks.map((risk, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border space-y-1.5 bg-slate-900/30"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">{risk.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 uppercase font-mono text-slate-400">
                          {risk.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{risk.description}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Intelligent Prioritization */}
            {activeTab === "prioritize" && prioritizeData && (
              <div className="space-y-3 animate-fade-in">
                <div className="text-xs text-slate-400 mb-2">
                  Recommended order of execution based on dependencies, due dates, and priority scores:
                </div>
                {prioritizeData.recommendations?.map((item) => (
                  <div
                    key={item.taskId}
                    className="p-3 rounded-xl border flex items-start gap-3 bg-slate-900/30"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20 shrink-0">
                      {item.suggestedRank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.reasoning}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 4: Context-Aware Q&A */}
            {activeTab === "qa" && (
              <div className="flex flex-col h-full space-y-4 animate-fade-in">
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {chatMessages.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-900/30 rounded-xl border" style={{ borderColor: "var(--card-border)" }}>
                      Ask questions about this project's tasks, milestones, overdue items, or documentation.
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl text-xs space-y-1 ${
                          msg.sender === "user"
                            ? "bg-indigo-600 text-white ml-6"
                            : "bg-slate-900 border text-slate-300 mr-6"
                        }`}
                        style={{ borderColor: "var(--card-border)" }}
                      >
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                        {msg.sources?.length > 0 && (
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                            Sources: {msg.sources.join(", ")}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {qaLoading && (
                    <div className="p-3 rounded-xl bg-slate-900 border text-slate-400 text-xs flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-indigo-500" />
                      <span>Thinking...</span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleAsk} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about project tasks, specs, overdue..."
                    className="flex-1 p-2.5 rounded-xl border text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    style={{
                      background: "var(--bg-main)",
                      borderColor: "var(--card-border)",
                      color: "var(--text-main)",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={qaLoading || !question.trim()}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition"
                  >
                    Ask
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";
import {
  Zap,
  Clock,
  Play,
  Pause,
  Plus,
  Trash2,
  X,
  History,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Layers,
} from "lucide-react";

export default function AutomationModal({
  open,
  onClose,
  projectId,
  workflowStatuses = [],
  members = [],
  onChanged,
}) {
  const [activeTab, setActiveTab] = useState("rules"); // 'rules' | 'recurring' | 'logs'
  const [rules, setRules] = useState([]);
  const [recurringTasks, setRecurringTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // New Rule Form State
  const [creatingRule, setCreatingRule] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("task_created");
  const [conditions, setConditions] = useState([]);
  const [actions, setActions] = useState([{ type: "set_status", payload: "in-progress" }]);

  // New Recurring Task Form State
  const [creatingRecurring, setCreatingRecurring] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  const [recDescription, setRecDescription] = useState("");
  const [recStatus, setRecStatus] = useState("todo");
  const [recPriority, setRecPriority] = useState("medium");
  const [recFrequency, setRecFrequency] = useState("weekly");
  const [recInterval, setRecInterval] = useState(1);
  const [recDaysOfWeek, setRecDaysOfWeek] = useState([1]); // Monday
  const [recEstimatedHours, setRecEstimatedHours] = useState("");
  const [recEndDate, setRecEndDate] = useState("");

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get(`/automations/rules/project/${projectId}`);
      setRules(res.data || []);
    } catch (err) {
      console.error("Failed to fetch automation rules:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecurring = async () => {
    try {
      const res = await axiosClient.get(`/automations/recurring/project/${projectId}`);
      setRecurringTasks(res.data || []);
    } catch (err) {
      console.error("Failed to fetch recurring tasks:", err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axiosClient.get(`/automations/logs/project/${projectId}`);
      setLogs(res.data || []);
    } catch (err) {
      console.error("Failed to fetch automation logs:", err);
    }
  };

  useEffect(() => {
    if (open && projectId) {
      if (activeTab === "rules") fetchRules();
      else if (activeTab === "recurring") fetchRecurring();
      else if (activeTab === "logs") fetchLogs();
    }
  }, [open, projectId, activeTab]);

  if (!open) return null;

  // Rule Handlers
  const handleToggleRule = async (rule) => {
    try {
      await axiosClient.put(`/automations/rules/${rule._id}`, {
        isActive: !rule.isActive,
      });
      fetchRules();
      if (onChanged) onChanged();
    } catch (err) {
      alert("Failed to toggle rule state");
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!confirm("Are you sure you want to delete this automation rule?")) return;
    try {
      await axiosClient.delete(`/automations/rules/${ruleId}`);
      fetchRules();
      if (onChanged) onChanged();
    } catch (err) {
      alert("Failed to delete rule");
    }
  };

  const handleAddCondition = () => {
    setConditions((prev) => [
      ...prev,
      { field: "priority", operator: "equals", value: "high" },
    ]);
  };

  const handleRemoveCondition = (index) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAction = () => {
    setActions((prev) => [
      ...prev,
      { type: "set_status", payload: workflowStatuses[0]?.key || "todo" },
    ]);
  };

  const handleRemoveAction = (index) => {
    if (actions.length <= 1) return;
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    try {
      await axiosClient.post("/automations/rules", {
        name: ruleName.trim(),
        description: ruleDescription.trim(),
        projectId,
        trigger: { event: triggerEvent },
        conditions,
        actions,
      });
      setCreatingRule(false);
      setRuleName("");
      setRuleDescription("");
      setConditions([]);
      setActions([{ type: "set_status", payload: "in-progress" }]);
      fetchRules();
      if (onChanged) onChanged();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create rule");
    }
  };

  // Recurring Task Handlers
  const handleToggleRecurring = async (rec) => {
    try {
      await axiosClient.put(`/automations/recurring/${rec._id}`, {
        isActive: !rec.isActive,
      });
      fetchRecurring();
      if (onChanged) onChanged();
    } catch (err) {
      alert("Failed to update recurring task");
    }
  };

  const handleDeleteRecurring = async (recId) => {
    if (!confirm("Are you sure you want to delete this recurring task template?")) return;
    try {
      await axiosClient.delete(`/automations/recurring/${recId}`);
      fetchRecurring();
      if (onChanged) onChanged();
    } catch (err) {
      alert("Failed to delete recurring task");
    }
  };

  const handleTriggerRecurringNow = async (recId) => {
    try {
      await axiosClient.post(`/automations/recurring/${recId}/trigger`);
      alert("Task instance generated successfully!");
      fetchRecurring();
      if (onChanged) onChanged();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to trigger recurring task");
    }
  };

  const handleSaveRecurring = async (e) => {
    e.preventDefault();
    if (!recTitle.trim()) return;

    try {
      await axiosClient.post("/automations/recurring", {
        title: recTitle.trim(),
        description: recDescription.trim(),
        projectId,
        status: recStatus,
        priority: recPriority,
        frequency: recFrequency,
        interval: Number(recInterval) || 1,
        daysOfWeek: recFrequency === "weekly" ? recDaysOfWeek : [],
        estimatedHours: recEstimatedHours ? Number(recEstimatedHours) : null,
        endDate: recEndDate || null,
      });
      setCreatingRecurring(false);
      setRecTitle("");
      setRecDescription("");
      setRecEstimatedHours("");
      setRecEndDate("");
      fetchRecurring();
      if (onChanged) onChanged();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create recurring task");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Workflow Automation & Recurring Tasks
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure event triggers, actions, and automated schedules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close automation dialog"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("rules")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "rules"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Rules ({rules.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("recurring")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "recurring"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recurring Tasks ({recurringTasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "logs"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Logs</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: AUTOMATION RULES */}
          {activeTab === "rules" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Active Project Rules
                </span>
                {!creatingRule && (
                  <button
                    onClick={() => setCreatingRule(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Rule</span>
                  </button>
                )}
              </div>

              {/* Create Rule Form */}
              {creatingRule && (
                <form
                  onSubmit={handleSaveRule}
                  className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Create Automation Rule
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCreatingRule(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Rule Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Auto-assign high priority bugs"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Trigger Event *
                      </label>
                      <select
                        value={triggerEvent}
                        onChange={(e) => setTriggerEvent(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="task_created">When a Task is Created</option>
                        <option value="status_changed">When Status Changes</option>
                        <option value="priority_changed">When Priority Changes</option>
                        <option value="assignee_changed">When Assignee Changes</option>
                        <option value="due_date_changed">When Due Date Changes</option>
                      </select>
                    </div>
                  </div>

                  {/* Conditions Section */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Conditions (Optional)
                      </span>
                      <button
                        type="button"
                        onClick={handleAddCondition}
                        className="text-xs text-indigo-600 font-semibold hover:underline"
                      >
                        + Add Condition
                      </button>
                    </div>

                    {conditions.map((cond, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={cond.field}
                          onChange={(e) => {
                            const updated = [...conditions];
                            updated[idx].field = e.target.value;
                            setConditions(updated);
                          }}
                          className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="priority">Priority</option>
                          <option value="status">Status</option>
                        </select>

                        <select
                          value={cond.operator}
                          onChange={(e) => {
                            const updated = [...conditions];
                            updated[idx].operator = e.target.value;
                            setConditions(updated);
                          }}
                          className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">not equals</option>
                        </select>

                        <input
                          type="text"
                          value={cond.value}
                          onChange={(e) => {
                            const updated = [...conditions];
                            updated[idx].value = e.target.value;
                            setConditions(updated);
                          }}
                          className="flex-1 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          placeholder="Value"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(idx)}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Actions Section */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Actions *
                      </span>
                      <button
                        type="button"
                        onClick={handleAddAction}
                        className="text-xs text-indigo-600 font-semibold hover:underline"
                      >
                        + Add Action
                      </button>
                    </div>

                    {actions.map((act, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={act.type}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx].type = e.target.value;
                            setActions(updated);
                          }}
                          className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="set_status">Set Status</option>
                          <option value="set_priority">Set Priority</option>
                          <option value="set_due_date_relative">Set Due Date (+Days)</option>
                        </select>

                        <input
                          type="text"
                          value={act.payload}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx].payload = e.target.value;
                            setActions(updated);
                          }}
                          className="flex-1 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          placeholder="Payload e.g. in-progress or 3"
                        />

                        {actions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAction(idx)}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs hover:bg-indigo-700 transition"
                    >
                      Save Rule
                    </button>
                  </div>
                </form>
              )}

              {/* Rules List */}
              <div className="space-y-2">
                {rules.length === 0 && !creatingRule && (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    No automation rules configured for this project.
                  </div>
                )}

                {rules.map((rule) => (
                  <div
                    key={rule._id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {rule.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            rule.isActive
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {rule.isActive ? "Active" : "Paused"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                        <span>Trigger: <strong>{rule.trigger?.event}</strong></span>
                        <span>•</span>
                        <span>Actions: <strong>{rule.actions?.length}</strong></span>
                        <span>•</span>
                        <span>Runs: <strong>{rule.executionCount || 0}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleRule(rule)}
                        className={`p-1.5 rounded-lg border ${
                          rule.isActive
                            ? "hover:bg-amber-50 text-amber-600 border-amber-200"
                            : "hover:bg-emerald-50 text-emerald-600 border-emerald-200"
                        }`}
                        title={rule.isActive ? "Pause Rule" : "Activate Rule"}
                      >
                        {rule.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleDeleteRule(rule._id)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:text-red-500 text-slate-400"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: RECURRING TASKS */}
          {activeTab === "recurring" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Recurring Task Schedules
                </span>
                {!creatingRecurring && (
                  <button
                    onClick={() => setCreatingRecurring(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Schedule Task</span>
                  </button>
                )}
              </div>

              {/* Create Recurring Task Form */}
              {creatingRecurring && (
                <form
                  onSubmit={handleSaveRecurring}
                  className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Schedule Recurring Task
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCreatingRecurring(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Task Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Weekly Security Review, Daily Standup Prep"
                      value={recTitle}
                      onChange={(e) => setRecTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Frequency *
                      </label>
                      <select
                        value={recFrequency}
                        onChange={(e) => setRecFrequency(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Interval (Every N)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={recInterval}
                        onChange={(e) => setRecInterval(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Priority
                      </label>
                      <select
                        value={recPriority}
                        onChange={(e) => setRecPriority(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs hover:bg-indigo-700 transition"
                    >
                      Schedule Task
                    </button>
                  </div>
                </form>
              )}

              {/* Recurring Tasks List */}
              <div className="space-y-2">
                {recurringTasks.length === 0 && !creatingRecurring && (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    No recurring task schedules found.
                  </div>
                )}

                {recurringTasks.map((rec) => (
                  <div
                    key={rec._id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {rec.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            rec.isActive
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {rec.isActive ? "Active" : "Paused"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                        <span>Frequency: <strong>{rec.frequency} (Every {rec.interval})</strong></span>
                        <span>•</span>
                        <span>Next Run: <strong>{rec.nextRunAt ? new Date(rec.nextRunAt).toLocaleDateString() : "—"}</strong></span>
                        <span>•</span>
                        <span>Generated: <strong>{rec.totalGenerated || 0}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTriggerRecurringNow(rec._id)}
                        className="px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50"
                        title="Generate task instance immediately"
                      >
                        Run Now
                      </button>

                      <button
                        onClick={() => handleToggleRecurring(rec)}
                        className={`p-1.5 rounded-lg border ${
                          rec.isActive
                            ? "hover:bg-amber-50 text-amber-600 border-amber-200"
                            : "hover:bg-emerald-50 text-emerald-600 border-emerald-200"
                        }`}
                        title={rec.isActive ? "Pause Schedule" : "Resume Schedule"}
                      >
                        {rec.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleDeleteRecurring(rec._id)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:text-red-500 text-slate-400"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === "logs" && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                Recent Automation Executions
              </span>

              {logs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  No automation executions recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log._id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {log.ruleName}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              log.status === "success"
                                ? "bg-emerald-100 text-emerald-700"
                                : log.status === "skipped"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Task: {log.taskTitle || log.taskId} • Trigger: {log.triggerEvent}
                          {log.reason && ` • ${log.reason}`}
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(log.executedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  Sparkles,
  GitBranch,
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
  const [conditionMatchMode, setConditionMatchMode] = useState("AND"); // 'AND' | 'OR'
  const [conditions, setConditions] = useState([]);
  const [actions, setActions] = useState([{ type: "set_status", payload: "in-progress" }]);
  const [elseActions, setElseActions] = useState([]);

  // Simulation / Dry-run State
  const [testingRule, setTestingRule] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

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

  const handleTestRule = async (rule) => {
    try {
      setTestingRule(rule);
      setSimulating(true);
      setSimulationResult(null);
      const res = await axiosClient.post(`/automations/rules/${rule._id}/test`, {});
      setSimulationResult(res.data?.simulation || null);
    } catch (err) {
      alert(err.response?.data?.message || "Dry-run simulation failed");
    } finally {
      setSimulating(false);
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

  const handleAddAction = (target = "actions") => {
    const newAction = { type: "set_status", payload: workflowStatuses[0]?.key || "todo" };
    if (target === "elseActions") {
      setElseActions((prev) => [...prev, newAction]);
    } else {
      setActions((prev) => [...prev, newAction]);
    }
  };

  const handleRemoveAction = (index, target = "actions") => {
    if (target === "elseActions") {
      setElseActions((prev) => prev.filter((_, i) => i !== index));
    } else {
      if (actions.length <= 1) return;
      setActions((prev) => prev.filter((_, i) => i !== index));
    }
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
        conditionMatchMode,
        conditions,
        actions,
        elseActions,
      });
      setCreatingRule(false);
      setRuleName("");
      setRuleDescription("");
      setConditions([]);
      setActions([{ type: "set_status", payload: "in-progress" }]);
      setElseActions([]);
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
                Configure event triggers, branching actions, schedules, and dry-run simulations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-5 border-b border-slate-100 dark:border-slate-800 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("rules")}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "rules"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Automation Rules ({rules.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("recurring")}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "recurring"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Recurring Schedules ({recurringTasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "logs"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Logs</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5">
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
                    <span>Create Rule</span>
                  </button>
                )}
              </div>

              {/* Create Rule Form */}
              {creatingRule && (
                <form
                  onSubmit={handleSaveRule}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      New Automation Rule
                    </span>
                    <button
                      type="button"
                      onClick={() => setCreatingRule(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Rule Name *
                      </label>
                      <input
                        type="text"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        placeholder="e.g. Auto-assign high priority bug"
                        required
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
                        <option value="scheduled_tick">On Scheduled Tick</option>
                      </select>
                    </div>
                  </div>

                  {/* Conditions Section */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Conditions (Optional)
                        </span>
                        <select
                          value={conditionMatchMode}
                          onChange={(e) => setConditionMatchMode(e.target.value)}
                          className="text-[10px] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                        >
                          <option value="AND">Match ALL (AND)</option>
                          <option value="OR">Match ANY (OR)</option>
                        </select>
                      </div>
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
                          <option value="title">Title</option>
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
                          <option value="contains">contains</option>
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

                  {/* Primary Actions Section */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Primary Actions (If Matched) *
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddAction("actions")}
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
                          <option value="dispatch_webhook">Dispatch Webhook</option>
                          <option value="send_slack_alert">Send Slack Alert</option>
                          <option value="create_task">Create Subtask/Task</option>
                        </select>

                        <input
                          type="text"
                          value={typeof act.payload === "string" ? act.payload : JSON.stringify(act.payload)}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx].payload = e.target.value;
                            setActions(updated);
                          }}
                          className="flex-1 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          placeholder="Payload e.g. in-progress or https://slack-webhook-url"
                        />

                        {actions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAction(idx, "actions")}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Branching Else Actions */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <GitBranch className="w-3 h-3 text-slate-400" />
                        <span>Else Branch (If Conditions Fail)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddAction("elseActions")}
                        className="text-xs text-indigo-600 font-semibold hover:underline"
                      >
                        + Add Else Action
                      </button>
                    </div>

                    {elseActions.map((act, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={act.type}
                          onChange={(e) => {
                            const updated = [...elseActions];
                            updated[idx].type = e.target.value;
                            setElseActions(updated);
                          }}
                          className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="set_status">Set Status</option>
                          <option value="set_priority">Set Priority</option>
                          <option value="set_due_date_relative">Set Due Date (+Days)</option>
                        </select>

                        <input
                          type="text"
                          value={typeof act.payload === "string" ? act.payload : JSON.stringify(act.payload)}
                          onChange={(e) => {
                            const updated = [...elseActions];
                            updated[idx].payload = e.target.value;
                            setElseActions(updated);
                          }}
                          className="flex-1 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          placeholder="Payload"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveAction(idx, "elseActions")}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

              {/* Simulation Result Modal / Panel */}
              {testingRule && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Dry-Run Simulation: {testingRule.name}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setTestingRule(null);
                        setSimulationResult(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Close
                    </button>
                  </div>

                  {simulating ? (
                    <div className="text-xs text-slate-500 py-2">Running dry-run simulation...</div>
                  ) : simulationResult ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-3">
                        <span>Branch Taken: <strong>{simulationResult.branchTaken}</strong></span>
                        <span>Mode: <strong>{simulationResult.conditionMatchMode}</strong></span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 space-y-1">
                        <span className="font-semibold block text-[11px] text-slate-700 dark:text-slate-300">
                          Simulated Mutations:
                        </span>
                        <pre className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300 overflow-x-auto">
                          {JSON.stringify(simulationResult.consolidatedUpdates, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </div>
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
                        {rule.elseActions?.length > 0 && (
                          <>
                            <span>•</span>
                            <span>Else: <strong>{rule.elseActions?.length}</strong></span>
                          </>
                        )}
                        <span>•</span>
                        <span>Runs: <strong>{rule.executionCount || 0}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTestRule(rule)}
                        className="px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50"
                        title="Dry Run Test Rule"
                      >
                        Dry Run
                      </button>

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

              {/* Create Recurring Form */}
              {creatingRecurring && (
                <form
                  onSubmit={handleSaveRecurring}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      New Recurring Task Schedule
                    </span>
                    <button
                      type="button"
                      onClick={() => setCreatingRecurring(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Task Title *
                      </label>
                      <input
                        type="text"
                        value={recTitle}
                        onChange={(e) => setRecTitle(e.target.value)}
                        placeholder="e.g. Weekly Team Retrospective"
                        required
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Initial Status
                      </label>
                      <select
                        value={recStatus}
                        onChange={(e) => setRecStatus(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="todo">To Do</option>
                        <option value="in-progress">In Progress</option>
                      </select>
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

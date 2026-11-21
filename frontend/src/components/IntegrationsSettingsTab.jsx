import React, { useState, useEffect } from "react";
import {
  Key,
  Webhook,
  Github,
  MessageSquare,
  Plus,
  Trash2,
  Check,
  Copy,
  ExternalLink,
  Shield,
  Activity,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardHeader,
  Badge,
  Modal,
} from "./ui";
import {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  getIntegrations,
  configureIntegration,
  removeIntegration,
  getWebhookSubscriptions,
  createWebhookSubscription,
  deleteWebhookSubscription,
} from "../api/integrationApi";

export default function IntegrationsSettingsTab({ workspaceId, isOwnerOrAdmin = true }) {
  const [subTab, setSubTab] = useState("api-keys"); // 'api-keys' | 'webhooks' | 'github' | 'slack'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // API Keys state
  const [apiKeys, setApiKeys] = useState([]);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState(["read:tasks", "write:tasks"]);
  const [createdRawKey, setCreatedRawKey] = useState("");
  const [copied, setCopied] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState([]);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState("");

  // Integrations state
  const [integrations, setIntegrations] = useState([]);
  const [githubRepo, setGithubRepo] = useState("");
  const [githubSecret, setGithubSecret] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");

  useEffect(() => {
    if (!workspaceId) return;
    loadData();
  }, [workspaceId, subTab]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      if (subTab === "api-keys") {
        const res = await getApiKeys(workspaceId);
        setApiKeys(res.data || []);
      } else if (subTab === "webhooks") {
        const res = await getWebhookSubscriptions(workspaceId);
        setWebhooks(res.data || []);
      } else {
        const res = await getIntegrations(workspaceId);
        setIntegrations(res.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load integration data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    try {
      const res = await createApiKey(workspaceId, {
        name: keyName.trim(),
        scopes: keyScopes,
      });
      setCreatedRawKey(res.data.rawKey);
      setKeyName("");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate API key");
    }
  };

  const handleRevokeKey = async (id) => {
    if (!window.confirm("Are you sure you want to revoke this API key? This action is immediate.")) return;
    try {
      await revokeApiKey(id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to revoke API key");
    }
  };

  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    if (!webhookName.trim() || !targetUrl.trim()) return;
    try {
      const res = await createWebhookSubscription(workspaceId, {
        name: webhookName.trim(),
        targetUrl: targetUrl.trim(),
        events: ["*"],
      });
      setCreatedWebhookSecret(res.data.secret);
      setWebhookName("");
      setTargetUrl("");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to register webhook");
    }
  };

  const handleDeleteWebhook = async (id) => {
    if (!window.confirm("Delete this webhook subscription?")) return;
    try {
      await deleteWebhookSubscription(id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete webhook");
    }
  };

  const handleSaveGithub = async (e) => {
    e.preventDefault();
    try {
      await configureIntegration(workspaceId, {
        provider: "github",
        name: "GitHub Repository Sync",
        config: { repository: githubRepo },
        credentials: githubSecret,
      });
      setSuccess("GitHub integration configured successfully");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to configure GitHub");
    }
  };

  const handleSaveSlack = async (e) => {
    e.preventDefault();
    try {
      await configureIntegration(workspaceId, {
        provider: "slack",
        name: "Slack Incoming Notifications",
        config: { webhookUrl: slackWebhookUrl },
      });
      setSuccess("Slack notifications integration configured successfully");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to configure Slack");
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-semibold">
        <button
          onClick={() => setSubTab("api-keys")}
          className={`pb-2 flex items-center gap-1.5 transition ${
            subTab === "api-keys"
              ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Key size={14} />
          Developer API Keys
        </button>
        <button
          onClick={() => setSubTab("webhooks")}
          className={`pb-2 flex items-center gap-1.5 transition ${
            subTab === "webhooks"
              ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Webhook size={14} />
          Outbound Webhooks
        </button>
        <button
          onClick={() => setSubTab("github")}
          className={`pb-2 flex items-center gap-1.5 transition ${
            subTab === "github"
              ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Github size={14} />
          GitHub Sync
        </button>
        <button
          onClick={() => setSubTab("slack")}
          className={`pb-2 flex items-center gap-1.5 transition ${
            subTab === "slack"
              ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <MessageSquare size={14} />
          Slack Alerts
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
          <Check size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* 1. API Keys View */}
      {subTab === "api-keys" && (
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Workspace API Keys</h3>
              <p className="text-xs text-slate-500">
                Grant external services scoped programmatic access to Klavo REST APIs.
              </p>
            </div>
            {isOwnerOrAdmin && (
              <Button
                id="btn-create-api-key"
                onClick={() => {
                  setCreatedRawKey("");
                  setKeyModalOpen(true);
                }}
                size="sm"
                className="flex items-center gap-1.5"
              >
                <Plus size={14} />
                Generate Key
              </Button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {apiKeys.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No API keys created for this workspace yet.</p>
            ) : (
              apiKeys.map((k) => (
                <div
                  key={k._id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{k.name}</span>
                      <span className="font-mono text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">
                        {k.keyPrefix}
                      </span>
                      <Badge variant={k.status === "active" ? "success" : "neutral"}>{k.status}</Badge>
                    </div>
                    <div className="flex gap-2 text-[11px] text-slate-400 mt-1">
                      <span>Scopes: {k.scopes?.join(", ") || "read:tasks"}</span>
                      {k.lastUsedAt && <span>• Last used: {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {isOwnerOrAdmin && k.status === "active" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevokeKey(k._id)}
                      className="text-xs"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* 2. Webhooks View */}
      {subTab === "webhooks" && (
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Outbound Webhooks</h3>
              <p className="text-xs text-slate-500">
                Subscribe to real-time events signed with HMAC-SHA256 authenticated payloads.
              </p>
            </div>
            {isOwnerOrAdmin && (
              <Button
                id="btn-add-webhook"
                onClick={() => {
                  setCreatedWebhookSecret("");
                  setWebhookModalOpen(true);
                }}
                size="sm"
                className="flex items-center gap-1.5"
              >
                <Plus size={14} />
                Add Webhook
              </Button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {webhooks.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No outbound webhook endpoints registered.</p>
            ) : (
              webhooks.map((w) => (
                <div
                  key={w._id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{w.name}</span>
                      <span className="text-[11px] font-mono text-slate-400">{w.targetUrl}</span>
                      <Badge variant={w.isActive ? "success" : "neutral"}>{w.isActive ? "active" : "inactive"}</Badge>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Events: {w.events?.join(", ") || "*"} {w.failureCount > 0 && `(Failures: ${w.failureCount})`}
                    </div>
                  </div>
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => handleDeleteWebhook(w._id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition"
                      title="Delete Webhook"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* 3. GitHub Sync View */}
      {subTab === "github" && (
        <Card className="p-6">
          <CardHeader
            title="GitHub Repository Integration"
            subtitle="Connect your GitHub repository to link commit activities, pull requests, and branch deployments to tasks."
          />
          <form onSubmit={handleSaveGithub} className="space-y-4 max-w-md">
            <Input
              label="Repository Name"
              placeholder="e.g. acme/web-app"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              required
            />
            <Input
              label="Webhook Secret (Optional)"
              type="password"
              placeholder="Optional secret for X-Hub-Signature-256 validation"
              value={githubSecret}
              onChange={(e) => setGithubSecret(e.target.value)}
            />
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">GitHub Payload URL:</span>
              <p className="font-mono text-indigo-600 dark:text-indigo-400 break-all">
                {window.location.origin}/api/integrations/inbound/github/{workspaceId}
              </p>
            </div>
            {isOwnerOrAdmin && (
              <Button type="submit" size="sm">
                Save GitHub Integration
              </Button>
            )}
          </form>
        </Card>
      )}

      {/* 4. Slack Alerts View */}
      {subTab === "slack" && (
        <Card className="p-6">
          <CardHeader
            title="Slack Workspace Alerts"
            subtitle="Send task assignments, project status alerts, and activity digests into your Slack channels."
          />
          <form onSubmit={handleSaveSlack} className="space-y-4 max-w-md">
            <Input
              label="Slack Incoming Webhook URL"
              placeholder="https://hooks.slack.com/services/..."
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
              required
            />
            {isOwnerOrAdmin && (
              <Button type="submit" size="sm">
                Connect Slack Webhook
              </Button>
            )}
          </form>
        </Card>
      )}

      {/* API Key Modal */}
      <Modal
        isOpen={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        title={createdRawKey ? "Save Your API Key" : "Generate New API Key"}
      >
        {createdRawKey ? (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              ⚠️ Copy this secret key now. For security purposes, it will never be displayed again.
            </div>
            <div className="flex items-center gap-2">
              <input
                id="raw-api-key-output"
                readOnly
                value={createdRawKey}
                className="w-full font-mono text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-indigo-500"
              />
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(createdRawKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setKeyModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateApiKey} className="space-y-4">
            <Input
              label="Key Name"
              placeholder="e.g. CI/CD Deployment Bot"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setKeyModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Generate
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Webhook Modal */}
      <Modal
        isOpen={webhookModalOpen}
        onClose={() => setWebhookModalOpen(false)}
        title={createdWebhookSecret ? "Webhook Registered" : "Add Webhook Endpoint"}
      >
        {createdWebhookSecret ? (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
              Webhook subscription active! Use this shared secret to verify incoming Klavo request signatures.
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={createdWebhookSecret}
                className="w-full font-mono text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-emerald-500"
              />
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(createdWebhookSecret);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setWebhookModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateWebhook} className="space-y-4">
            <Input
              label="Endpoint Name"
              placeholder="e.g. Analytics Pipeline"
              value={webhookName}
              onChange={(e) => setWebhookName(e.target.value)}
              required
            />
            <Input
              label="Payload Target URL"
              placeholder="https://example.com/api/webhooks/klavo"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setWebhookModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Register
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

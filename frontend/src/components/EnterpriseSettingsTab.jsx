import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";
import { Card, Button, Badge } from "./ui";
import {
  Building2,
  ShieldCheck,
  KeyRound,
  FileText,
  Users,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Lock,
} from "lucide-react";

export default function EnterpriseSettingsTab({ workspaceId, isOwnerOrAdmin = true }) {
  const [activeSubTab, setActiveSubTab] = useState("policies"); // "policies" | "roles" | "sso" | "audit"
  const [loading, setLoading] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [customRoles, setCustomRoles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditVerified, setAuditVerified] = useState(null);

  // Policy Form State
  const [domainCheckEnabled, setDomainCheckEnabled] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState("");
  const [sessionMaxAge, setSessionMaxAge] = useState(1440);

  // Custom Role Form State
  const [creatingRole, setCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [rolePermissions, setRolePermissions] = useState({
    manageMembers: false,
    manageSettings: false,
    manageIntegrations: false,
    exportData: false,
    viewAuditLogs: true,
  });

  // SSO Form State
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoProvider, setSsoProvider] = useState("saml2");
  const [issuerUrl, setIssuerUrl] = useState("https://identity.enterprise.com");
  const [entryPoint, setEntryPoint] = useState("https://identity.enterprise.com/sso/saml");

  const loadData = async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const wsRes = await axiosClient.get(`/teams/${workspaceId}`);
      setWorkspace(wsRes.data);
      if (wsRes.data?.policies) {
        setDomainCheckEnabled(Boolean(wsRes.data.policies.enforceDomainCheck));
        setAllowedDomains((wsRes.data.policies.allowedEmailDomains || []).join(", "));
        setSessionMaxAge(wsRes.data.policies.sessionMaxAgeMinutes || 1440);
      }

      const rolesRes = await axiosClient.get(`/enterprise/roles/workspace/${workspaceId}`);
      setCustomRoles(rolesRes.data || []);

      const logsRes = await axiosClient.get(`/enterprise/audit/logs?workspaceId=${workspaceId}&limit=25`);
      setAuditLogs(logsRes.data || []);
    } catch (err) {
      console.error("Failed to load enterprise settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const handleSavePolicies = async (e) => {
    e.preventDefault();
    try {
      const parsedDomains = allowedDomains
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0)
        .map((d) => (d.startsWith("@") ? d : `@${d}`));

      await axiosClient.put(`/teams/${workspaceId}`, {
        policies: {
          enforceDomainCheck: domainCheckEnabled,
          allowedEmailDomains: parsedDomains,
          sessionMaxAgeMinutes: Number(sessionMaxAge),
        },
      });
      alert("Workspace security policies updated successfully.");
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update policies");
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      await axiosClient.post("/enterprise/roles", {
        workspaceId,
        name: newRoleName.trim(),
        description: newRoleDesc.trim(),
        permissions: rolePermissions,
      });
      setCreatingRole(false);
      setNewRoleName("");
      setNewRoleDesc("");
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create role");
    }
  };

  const handleVerifyAuditChain = async () => {
    try {
      const res = await axiosClient.post("/enterprise/audit/verify", { workspaceId });
      setAuditVerified(res.data?.verification);
    } catch (err) {
      alert("Verification failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Sub-navigation */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("policies")}
          className={`px-3 py-1.5 rounded-lg transition ${
            activeSubTab === "policies"
              ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          Policies & Security
        </button>

        <button
          onClick={() => setActiveSubTab("roles")}
          className={`px-3 py-1.5 rounded-lg transition ${
            activeSubTab === "roles"
              ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          Custom Roles ({customRoles.length})
        </button>

        <button
          onClick={() => setActiveSubTab("sso")}
          className={`px-3 py-1.5 rounded-lg transition ${
            activeSubTab === "sso"
              ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          Single Sign-On (SAML/OIDC)
        </button>

        <button
          onClick={() => setActiveSubTab("audit")}
          className={`px-3 py-1.5 rounded-lg transition ${
            activeSubTab === "audit"
              ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          Audit History & Verification
        </button>
      </div>

      {/* SUBTAB 1: Policies */}
      {activeSubTab === "policies" && (
        <Card className="p-6 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Workspace Domain & Invitation Policies
            </h4>
            <p className="text-xs text-slate-500">
              Restrict member invitations to approved corporate email domains and govern session expiry.
            </p>
          </div>

          <form onSubmit={handleSavePolicies} className="space-y-4 max-w-xl">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enforceDomainCheck"
                checked={domainCheckEnabled}
                onChange={(e) => setDomainCheckEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="enforceDomainCheck" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Enforce domain restrictions on new member invitations
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Allowed Email Domains (comma separated)
              </label>
              <input
                type="text"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                placeholder="e.g. @acme.com, @acme.corp"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Max Session Duration (Minutes)
              </label>
              <input
                type="number"
                min="15"
                max="43200"
                value={sessionMaxAge}
                onChange={(e) => setSessionMaxAge(e.target.value)}
                className="w-32 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <Button type="submit" variant="primary" size="sm" disabled={!isOwnerOrAdmin}>
              Save Policies
            </Button>
          </form>
        </Card>
      )}

      {/* SUBTAB 2: Custom Roles */}
      {activeSubTab === "roles" && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Granular Role Definitions
              </h4>
              <p className="text-xs text-slate-500">
                Define fine-grained permission assignments beyond standard Owner/Admin/Member tiers.
              </p>
            </div>
            {!creatingRole && isOwnerOrAdmin && (
              <Button size="xs" variant="primary" onClick={() => setCreatingRole(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Role
              </Button>
            )}
          </div>

          {creatingRole && (
            <form onSubmit={handleCreateRole} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">New Custom Role</span>
                <button type="button" onClick={() => setCreatingRole(false)} className="text-xs text-slate-400">Cancel</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Role Name (e.g. Security Auditor)"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  required
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <input
                  type="text"
                  placeholder="Role Description"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs">
                {Object.keys(rolePermissions).map((permKey) => (
                  <label key={permKey} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rolePermissions[permKey]}
                      onChange={(e) => setRolePermissions({ ...rolePermissions, [permKey]: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span className="capitalize">{permKey.replace(/([A-Z])/g, " $1")}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" size="xs">Save Role</Button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {customRoles.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No custom roles defined yet. Default workspace roles (Owner, Admin, Member, Guest) are active.
              </div>
            ) : (
              customRoles.map((role) => (
                <div key={role._id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white mr-2">{role.name}</span>
                    <span className="text-slate-500">{role.description}</span>
                  </div>
                  <Badge variant="neutral">Custom Role</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* SUBTAB 3: SSO */}
      {activeSubTab === "sso" && (
        <Card className="p-6 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              Enterprise Single Sign-On (SAML 2.0 / OIDC)
            </h4>
            <p className="text-xs text-slate-500">
              Connect Okta, Azure AD, or Google Workspace to manage identity and enforce unified authentication.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs space-y-2">
            <div className="font-bold text-indigo-900 dark:text-indigo-200">Assertion Consumer Service (ACS) URL:</div>
            <code className="block p-2 rounded bg-white dark:bg-slate-900 border font-mono text-[11px] text-slate-800 dark:text-slate-200">
              {window.location.origin}/api/enterprise/sso/saml/acs
            </code>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
              Configure this endpoint in your Identity Provider (IdP) as the SAML Recipient / Single Sign-On URL.
            </p>
          </div>

          <div className="space-y-3 max-w-xl text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Identity Provider Issuer URL</label>
              <input
                type="text"
                value={issuerUrl}
                onChange={(e) => setIssuerUrl(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">IdP Single Sign-On Entrypoint</label>
              <input
                type="text"
                value={entryPoint}
                onChange={(e) => setEntryPoint(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>
        </Card>
      )}

      {/* SUBTAB 4: Audit Logs */}
      {activeSubTab === "audit" && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Tamper-Resistant Audit Trail
              </h4>
              <p className="text-xs text-slate-500">
                Cryptographically linked event sequence recording administrative actions and access mutations.
              </p>
            </div>
            <Button size="xs" variant="secondary" onClick={handleVerifyAuditChain}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Verify Integrity
            </Button>
          </div>

          {auditVerified && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              auditVerified.valid
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300"
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              {auditVerified.valid ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>
                Chain Integrity Verified: {auditVerified.totalChecked} sequential event blocks cryptographically intact.
              </span>
            </div>
          )}

          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No administrative audit events recorded yet for this workspace.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log._id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">#{log.sequence}</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{log.action}</span>
                      <Badge variant="neutral">{log.actorRole}</Badge>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Actor: {log.actorEmail} • Target: {log.targetType} {log.targetId ? `(${log.targetId})` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {log.hash?.slice(0, 12)}...
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

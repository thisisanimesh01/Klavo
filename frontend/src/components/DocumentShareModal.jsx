import React, { useState } from "react";
import axiosClient from "../api/axiosClient";
import {
  Share2,
  X,
  Shield,
  UserCheck,
  UserX,
  Crown,
  ChevronDown,
  Globe,
  Lock,
  ArrowRightLeft,
  Check,
} from "lucide-react";

const ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer", desc: "Can read the document" },
  { value: "commenter", label: "Commenter", desc: "Can read and comment" },
  { value: "editor", label: "Editor", desc: "Can edit content and collaborate in real time" },
  { value: "owner", label: "Owner", desc: "Full control, manage sharing and delete" },
];

export default function DocumentShareModal({
  isOpen,
  onClose,
  document,
  projectTeamMembers = [],
  currentUser,
  onUpdateDocument,
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("editor");
  const [defaultAccess, setDefaultAccess] = useState(document?.defaultAccess || "editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isOpen || !document) return null;

  const isOwner =
    document.userPermission?.canManagePermissions ||
    document.createdBy?._id === currentUser?._id;

  // Filter members eligible for direct sharing (exclude document creator)
  const creatorId = document.createdBy?._id || document.createdBy;
  const eligibleMembers = projectTeamMembers.filter(
    (m) => m._id !== creatorId
  );

  // Handle adding or updating share grant
  const handleAddShare = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const res = await axiosClient.post(`/documents/${document._id}/share`, {
        userId: selectedUserId,
        role: selectedRole,
      });

      onUpdateDocument(res.data.document);
      setSelectedUserId("");
      setSuccess("Access granted successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update share");
    } finally {
      setLoading(false);
    }
  };

  // Handle changing user role inline
  const handleChangeRole = async (targetUserId, newRole) => {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.post(`/documents/${document._id}/share`, {
        userId: targetUserId,
        role: newRole,
      });

      onUpdateDocument(res.data.document);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  // Handle revoking access
  const handleRevokeShare = async (targetUserId) => {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.delete(
        `/documents/${document._id}/share/${targetUserId}`
      );

      onUpdateDocument(res.data.document);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to revoke share");
    } finally {
      setLoading(false);
    }
  };

  // Handle updating project-wide default access
  const handleUpdateDefaultAccess = async (newDefault) => {
    try {
      setLoading(true);
      setError("");
      setDefaultAccess(newDefault);

      const res = await axiosClient.post(`/documents/${document._id}/share`, {
        defaultAccess: newDefault,
      });

      onUpdateDocument(res.data.document);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update default access");
    } finally {
      setLoading(false);
    }
  };

  // Handle ownership transfer
  const handleTransferOwnership = async (newOwnerId) => {
    if (!window.confirm("Transfer document ownership? You will become an Editor.")) return;
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.post(`/documents/${document._id}/transfer-ownership`, {
        newOwnerId,
      });

      onUpdateDocument(res.data.document);
      setSuccess("Ownership transferred successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to transfer ownership");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Share Document
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">
                "{document.title || "Untitled"}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-3.5 h-3.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Add Share Form */}
        {isOwner && (
          <form onSubmit={handleAddShare} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Invite Team Member
            </label>
            <div className="flex gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select team member...</option>
                {eligibleMembers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-32 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={!selectedUserId || loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-xs transition"
              >
                Share
              </button>
            </div>
          </form>
        )}

        {/* General / Default Team Access */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Project Members Access
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Anyone on this project team who is not explicitly listed below
                </span>
              </div>
            </div>

            {isOwner ? (
              <select
                value={defaultAccess}
                onChange={(e) => handleUpdateDefaultAccess(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
              >
                <option value="editor">Editor</option>
                <option value="commenter">Commenter</option>
                <option value="viewer">Viewer</option>
              </select>
            ) : (
              <span className="text-xs capitalize font-medium text-slate-600 dark:text-slate-400">
                {defaultAccess}
              </span>
            )}
          </div>
        </div>

        {/* People with Access List */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            People with Access
          </h4>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {/* Document Creator / Owner */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  {document.createdBy?.name ? document.createdBy.name.charAt(0).toUpperCase() : "O"}
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    {document.createdBy?.name || "Document Creator"}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {document.createdBy?.email}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Owner
              </span>
            </div>

            {/* Direct Shares */}
            {document.shares && document.shares.length > 0 ? (
              document.shares.map((share) => {
                const u = share.userId;
                if (!u) return null;
                return (
                  <div
                    key={u._id || u}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
                        {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block">
                          {u.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {u.email}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <>
                          <select
                            value={share.role}
                            onChange={(e) => handleChangeRole(u._id || u, e.target.value)}
                            className="px-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 capitalize font-medium"
                          >
                            <option value="editor">Editor</option>
                            <option value="commenter">Commenter</option>
                            <option value="viewer">Viewer</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleTransferOwnership(u._id || u)}
                            className="p-1 text-slate-400 hover:text-amber-500 transition"
                            title="Transfer Ownership"
                          >
                            <Crown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRevokeShare(u._id || u)}
                            className="p-1 text-slate-400 hover:text-red-500 transition"
                            title="Revoke access"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs capitalize font-medium text-slate-500">
                          {share.role}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-3 text-[11px] text-slate-400">
                No individual member overrides. All project members have {defaultAccess} access.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

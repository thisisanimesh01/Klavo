import React, { useState, useEffect, useCallback } from "react";
import axiosClient from "../api/axiosClient";
import {
  History,
  RotateCcw,
  GitCompare,
  Plus,
  Clock,
  User,
  Bookmark,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Eye,
  Calendar,
} from "lucide-react";

export default function DocumentVersionHistoryModal({
  isOpen,
  onClose,
  document,
  canEdit = true,
  onVersionRestored,
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [diffData, setDiffData] = useState(null);
  const [snapshotName, setSnapshotName] = useState("");
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchVersions = useCallback(async () => {
    if (!document?._id) return;
    try {
      setLoading(true);
      const res = await axiosClient.get(`/documents/${document._id}/versions`);
      const list = res.data?.versions || [];
      setVersions(list);
      if (list.length > 0 && !selectedVersion) {
        setSelectedVersion(list[0]);
      }
    } catch (err) {
      console.error("Failed to fetch versions:", err);
      setError("Failed to load version history");
    } finally {
      setLoading(false);
    }
  }, [document?._id, selectedVersion]);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, fetchVersions]);

  // Fetch diff comparison between selected version and current doc
  const handleCompare = async (version) => {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get(`/documents/${document._id}/versions/compare`, {
        params: {
          sourceVersionId: version._id,
        },
      });
      setDiffData(res.data?.diff || []);
      setCompareMode(true);
    } catch (err) {
      console.error("Failed to compare versions:", err);
      setError("Failed to load diff comparison");
    } finally {
      setLoading(false);
    }
  };

  // Create manual named snapshot
  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    if (!snapshotName.trim() || !canEdit) return;

    try {
      setCreatingSnapshot(true);
      setError("");
      const res = await axiosClient.post(`/documents/${document._id}/versions`, {
        name: snapshotName.trim(),
        changeSummary: "Named version checkpoint",
      });

      setVersions((prev) => [res.data, ...prev]);
      setSelectedVersion(res.data);
      setSnapshotName("");
      setSuccess("Named snapshot created successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create snapshot");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  // Restore document to a version
  const handleRestore = async (version) => {
    if (!window.confirm(`Restore document to Revision #${version.revisionNumber}? This will create a new revision without erasing history.`)) return;

    try {
      setRestoring(true);
      setError("");

      const res = await axiosClient.post(
        `/documents/${document._id}/versions/${version._id}/restore`
      );

      if (onVersionRestored) {
        onVersionRestored(res.data.document);
      }

      setSuccess(`Restored successfully to Revision #${version.revisionNumber}`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to restore version");
    } finally {
      setRestoring(false);
    }
  };

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full h-[92vh] sm:h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Version History & Recovery
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-sm">
                "{document.title || "Untitled"}"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="px-6 py-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="px-6 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}

        {/* Modal Body: Split view of Version List (Left) and Content/Diff Preview (Right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Revisions Timeline */}
          <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-slate-50/30 dark:bg-slate-900/40">
            {/* Create Named Snapshot Form */}
            {canEdit && (
              <form onSubmit={handleCreateSnapshot} className="p-3 border-b border-slate-200 dark:border-slate-800 flex gap-2">
                <input
                  type="text"
                  placeholder="Name checkpoint..."
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!snapshotName.trim() || creatingSnapshot}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center gap-1 shrink-0"
                  title="Create named snapshot"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </form>
            )}

            {/* Versions List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading && versions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading revisions...</div>
              ) : versions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No revisions found.</div>
              ) : (
                versions.map((ver) => {
                  const isSelected = selectedVersion?._id === ver._id;
                  return (
                    <div
                      key={ver._id}
                      onClick={() => {
                        setSelectedVersion(ver);
                        setCompareMode(false);
                      }}
                      className={`p-3 rounded-xl transition text-left cursor-pointer space-y-1 border ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 shadow-xs"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800/60 border-transparent text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          {ver.isNamedSnapshot ? (
                            <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>
                            {ver.isNamedSnapshot
                              ? ver.snapshotName
                              : `Revision #${ver.revisionNumber}`}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(ver.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {ver.changeSummary && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {ver.changeSummary}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{ver.authorId?.name || "Author"}</span>
                        </span>
                        <span>{new Date(ver.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Version Preview / Diff Viewer */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-between">
            {selectedVersion ? (
              <div className="space-y-4">
                {/* Revision Header & Action Toolbar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Revision #{selectedVersion.revisionNumber}
                      </span>
                      {selectedVersion.isNamedSnapshot && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                          {selectedVersion.snapshotName}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {selectedVersion.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCompare(selectedVersion)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition border flex items-center gap-1.5 ${
                        compareMode
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                      title="Compare against current document"
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      <span>{compareMode ? "Viewing Diff" : "Compare"}</span>
                    </button>

                    {canEdit && (
                      <button
                        onClick={() => handleRestore(selectedVersion)}
                        disabled={restoring}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1.5"
                        title="Restore this version"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Diff Comparison View */}
                {compareMode && diffData ? (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Differences vs Current Version:</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-900/60 inline-block" />
                          <span>Added in Current</span>
                        </span>
                        <span className="flex items-center gap-1 text-red-500">
                          <span className="w-2.5 h-2.5 rounded-sm bg-red-200 dark:bg-red-900/60 inline-block" />
                          <span>Removed from Revision</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-xs leading-relaxed font-mono whitespace-pre-wrap p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[200px]">
                      {diffData.map((d, i) => (
                        <span
                          key={i}
                          className={`inline-block mr-1 my-0.5 px-1 py-0.5 rounded ${
                            d.type === "added"
                              ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold"
                              : d.type === "removed"
                              ? "bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 line-through"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {d.value}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Formatted HTML Snapshot Preview */
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs prose dark:prose-invert max-w-none min-h-[300px]">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: selectedVersion.contentHtml || "<p>No content snapshot available.</p>",
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-xs text-slate-400">
                Select a revision to preview content or compare differences.
              </div>
            )}

            {/* Modal Bottom Close */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

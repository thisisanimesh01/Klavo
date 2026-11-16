import React, { useState } from "react";
import {
  Bookmark,
  Share2,
  Lock,
  Plus,
  Trash2,
  Check,
  Star,
  ChevronDown,
  SlidersHorizontal,
  X,
  Filter,
} from "lucide-react";

export default function SavedViewsBar({
  savedViews = [],
  activeViewId = null,
  onSelectView,
  onClearView,
  onCreateView,
  onDeleteView,
  onToggleShared,
  currentUserId,
  isTeamOwner,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewDescription, setNewViewDescription] = useState("");
  const [newViewShared, setNewViewShared] = useState(false);
  const [newViewDefault, setNewViewDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeView = savedViews.find((v) => v._id === activeViewId);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newViewName.trim()) return;
    try {
      setSubmitting(true);
      await onCreateView({
        name: newViewName.trim(),
        description: newViewDescription.trim(),
        isShared: newViewShared,
        isDefault: newViewDefault,
      });
      setNewViewName("");
      setNewViewDescription("");
      setNewViewShared(false);
      setNewViewDefault(false);
      setCreateModalOpen(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create saved view");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5 px-3 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-xs text-xs">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
        <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
        <span>Views:</span>
      </div>

      {/* Default "All Tasks" View Pill */}
      <button
        onClick={onClearView}
        className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
          !activeViewId
            ? "bg-indigo-600 text-white shadow-xs"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        <span>Standard View</span>
      </button>

      {/* Pinned / Visible Saved Views (first 4) */}
      {savedViews.slice(0, 4).map((view) => {
        const isActive = view._id === activeViewId;
        const isCreator = view.createdBy?._id === currentUserId || view.createdBy === currentUserId;
        const canDelete = isCreator || isTeamOwner;

        return (
          <div
            key={view._id}
            className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              isActive
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span
              onClick={() => onSelectView(view)}
              className="flex items-center gap-1.5 truncate max-w-[140px]"
              title={view.description || view.name}
            >
              {view.isShared ? (
                <Share2 className={`w-3 h-3 ${isActive ? "text-indigo-200" : "text-slate-400"}`} />
              ) : (
                <Lock className={`w-3 h-3 ${isActive ? "text-indigo-200" : "text-slate-400"}`} />
              )}
              {view.name}
              {view.isDefault && (
                <Star className={`w-2.5 h-2.5 fill-current ${isActive ? "text-amber-200" : "text-amber-500"}`} />
              )}
            </span>

            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete saved view "${view.name}"?`)) {
                    onDeleteView(view._id);
                  }
                }}
                className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition ${
                  isActive ? "text-indigo-200" : "text-slate-400"
                }`}
                title="Delete view"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      {/* Dropdown for More Views if > 4 */}
      {savedViews.length > 4 && (
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
          >
            <span>More ({savedViews.length - 4})</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2 space-y-1">
              {savedViews.slice(4).map((view) => {
                const isActive = view._id === activeViewId;
                const isCreator = view.createdBy?._id === currentUserId || view.createdBy === currentUserId;
                const canDelete = isCreator || isTeamOwner;

                return (
                  <div
                    key={view._id}
                    onClick={() => {
                      onSelectView(view);
                      setDropdownOpen(false);
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {view.isShared ? (
                        <Share2 className="w-3 h-3 text-slate-400 shrink-0" />
                      ) : (
                        <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{view.name}</span>
                    </div>

                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete saved view "${view.name}"?`)) {
                            onDeleteView(view._id);
                          }
                        }}
                        className="text-slate-400 hover:text-red-500 p-1 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save Current Filters as View Button */}
      <button
        onClick={() => setCreateModalOpen(true)}
        className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold transition"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Save Current View</span>
      </button>

      {/* Modal to Save View */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-indigo-500" />
                Save Custom View
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  View Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical Bugs, My In-Progress Tasks"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  placeholder="Brief context for team members"
                  value={newViewDescription}
                  onChange={(e) => setNewViewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newViewShared}
                    onChange={(e) => setNewViewShared(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Share view with all team members in this project</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newViewDefault}
                    onChange={(e) => setNewViewDefault(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Set as my default view when opening this project</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save View"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

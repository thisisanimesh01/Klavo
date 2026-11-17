import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import socket from "../socket";
import { useSelector } from "react-redux";
import TipTapEditor from "../components/TipTapEditor";
import ThemeToggle from "../components/ThemeToggle";
import DocumentShareModal from "../components/DocumentShareModal";
import DocumentCommentsPanel from "../components/DocumentCommentsPanel";
import DocumentVersionHistoryModal from "../components/DocumentVersionHistoryModal";
import LinkedTasksDrawer from "../components/LinkedTasksDrawer";
import { CollabSocketProvider } from "../utils/collabSocketProvider";
import * as Y from "yjs";
import {
  BookOpen,
  Home,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Share2,
  Users,
  History,
  MessageSquare,
  FileText,
  CornerDownRight,
  FolderTree,
  ExternalLink,
  Sparkles,
  Move,
  ArrowUp,
  ArrowDown,
  Lock,
  CheckSquare,
} from "lucide-react";

export default function Wiki() {
  const { projectId, documentId } = useParams();
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.auth?.user);

  const [project, setProject] = useState(null);
  const [wikiPages, setWikiPages] = useState([]);
  const [wikiTree, setWikiTree] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved' | 'saving' | 'unsaved' | 'error'
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Real-time collaborator presence & Yjs state
  const [collaborators, setCollaborators] = useState([]);
  const [collabYDoc, setCollabYDoc] = useState(null);
  const [collabProvider, setCollabProvider] = useState(null);
  const [collabSessionEpoch, setCollabSessionEpoch] = useState(1);

  // Comments (DOC-05) & Version History (DOC-06)
  const [comments, setComments] = useState([]);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState(null);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  // Linked Tasks Drawer (DOC-08)
  const [linkedTasksOpen, setLinkedTasksOpen] = useState(false);

  // Modals & Organization State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [newPageModalOpen, setNewPageModalOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageParentId, setNewPageParentId] = useState("root");
  const [newPageIsHome, setNewPageIsHome] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [targetParentId, setTargetParentId] = useState("root");

  // Local draft state
  const [title, setTitle] = useState("");
  const contentRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Load project details
  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await axiosClient.get(`/projects/${projectId}`);
      setProject(res.data);
    } catch (err) {
      console.error("Failed to load project details:", err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Load Wiki Pages & Tree
  const fetchWikiPages = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await axiosClient.get(`/documents/wiki/project/${projectId}`, {
        params: { search: searchQuery },
      });
      setWikiPages(res.data.pages || []);
      setWikiTree(res.data.tree || []);

      // Auto-expand all nodes initially
      const allIds = new Set();
      const collectIds = (nodes) => {
        nodes.forEach((n) => {
          allIds.add(n._id);
          if (n.children && n.children.length > 0) collectIds(n.children);
        });
      };
      collectIds(res.data.tree || []);
      setExpandedNodes(allIds);
    } catch (err) {
      console.error("Failed to load wiki pages:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, searchQuery]);

  useEffect(() => {
    fetchWikiPages();
  }, [fetchWikiPages]);

  // Load active Wiki page (or default Home if no documentId param)
  const loadActivePage = useCallback(
    async (targetId) => {
      try {
        setSaveStatus("saving");
        let res;
        if (targetId) {
          res = await axiosClient.get(`/documents/wiki/${targetId}`);
        } else {
          res = await axiosClient.get(`/documents/wiki/project/${projectId}/home`);
        }

        const page = res.data;
        setSelectedPage(page);
        setTitle(page.title);
        contentRef.current = page.content;
        setSaveStatus("saved");

        // Keep browser URL synchronized with active wiki page
        if (!targetId && page._id) {
          navigate(`/wiki/${projectId}/${page._id}`, { replace: true });
        }
      } catch (err) {
        console.error("Failed to load active wiki page:", err);
        setSaveStatus("error");
      }
    },
    [projectId, navigate]
  );

  useEffect(() => {
    if (projectId) {
      loadActivePage(documentId);
    }
  }, [projectId, documentId, loadActivePage]);

  // Setup Yjs Collaborative Editing Room for active Wiki Page
  useEffect(() => {
    if (!selectedPage || !selectedPage._id) return;

    const ydoc = new Y.Doc();
    setCollabYDoc(ydoc);

    const provider = new CollabSocketProvider({
      doc: ydoc,
      documentId: selectedPage._id,
      user: authUser,
      socket,
      onCollaboratorsChange: (activeCollabs) => {
        setCollaborators(activeCollabs);
      },
      onResetState: ({ yjsUpdate }) => {
        if (yjsUpdate) {
          try {
            const bytes = Uint8Array.from(atob(yjsUpdate), (c) => c.charCodeAt(0));
            Y.applyUpdate(ydoc, bytes);
          } catch (e) {
            console.error("Failed applying reset update to active ydoc:", e);
          }
        }
        setCollabSessionEpoch((prev) => prev + 1);
      },
    });

    setCollabProvider(provider);

    return () => {
      provider.destroy();
      ydoc.destroy();
      setCollabYDoc(null);
      setCollabProvider(null);
    };
  }, [selectedPage?._id, authUser, collabSessionEpoch]);

  // Load comments for active page
  const fetchComments = useCallback(async () => {
    if (!selectedPage?._id) return;
    try {
      const res = await axiosClient.get(`/documents/${selectedPage._id}/comments`);
      setComments(res.data || []);
    } catch (err) {
      console.error("Failed to fetch wiki comments:", err);
    }
  }, [selectedPage?._id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Socket listeners for real-time wiki updates
  useEffect(() => {
    if (!socket.connected) socket.connect();
    if (projectId) socket.emit("joinProject", { projectId });

    const onWikiPageCreated = (newPage) => {
      fetchWikiPages();
    };

    const onWikiPageUpdated = (updatedPage) => {
      setWikiPages((prev) =>
        prev.map((p) => (p._id === updatedPage._id ? { ...p, ...updatedPage } : p))
      );
      if (selectedPage && selectedPage._id === updatedPage._id) {
        setSelectedPage((prev) => ({ ...prev, ...updatedPage }));
        setTitle(updatedPage.title);
      }
    };

    const onWikiPageDeleted = ({ documentId: delId }) => {
      setWikiPages((prev) => prev.filter((p) => p._id !== delId));
      if (selectedPage && selectedPage._id === delId) {
        navigate(`/wiki/${projectId}`);
      }
      fetchWikiPages();
    };

    const onWikiTreeReordered = () => {
      fetchWikiPages();
    };

    socket.on("wikiPageCreated", onWikiPageCreated);
    socket.on("wikiPageUpdated", onWikiPageUpdated);
    socket.on("wikiPageDeleted", onWikiPageDeleted);
    socket.on("wikiTreeReordered", onWikiTreeReordered);

    return () => {
      socket.off("wikiPageCreated", onWikiPageCreated);
      socket.off("wikiPageUpdated", onWikiPageUpdated);
      socket.off("wikiPageDeleted", onWikiPageDeleted);
      socket.off("wikiTreeReordered", onWikiTreeReordered);
    };
  }, [projectId, selectedPage, fetchWikiPages, navigate]);

  // Auto-save debouncer for active page
  const saveDocumentChanges = useCallback(
    async (newTitle, newContent, newHtml) => {
      if (!selectedPage || !selectedPage._id) return;
      if (!selectedPage.userPermission?.canEdit) return;

      try {
        setSaving(true);
        setSaveStatus("saving");

        const payload = {};
        if (newTitle !== undefined) payload.title = newTitle;
        if (newContent !== undefined) payload.content = newContent;
        if (newHtml !== undefined) payload.contentHtml = newHtml;

        const res = await axiosClient.put(`/documents/wiki/${selectedPage._id}`, payload);
        setSelectedPage(res.data);
        setSaveStatus("saved");

        // Update list cache
        setWikiPages((prev) =>
          prev.map((p) => (p._id === res.data._id ? { ...p, ...res.data } : p))
        );
      } catch (err) {
        console.error("Autosave wiki page failed:", err);
        setSaveStatus("error");
      } finally {
        setSaving(false);
      }
    },
    [selectedPage]
  );

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    setSaveStatus("unsaved");

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDocumentChanges(val, undefined, undefined);
    }, 1000);
  };

  const handleEditorUpdate = ({ json, html }) => {
    contentRef.current = json;
    setSaveStatus("unsaved");

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDocumentChanges(undefined, json, html);
    }, 1500);
  };

  // Toggle node expand/collapse
  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Create new wiki page
  const handleCreatePage = async (e) => {
    e.preventDefault();
    if (!newPageTitle.trim()) return;

    try {
      const payload = {
        title: newPageTitle.trim(),
        projectId,
        parentWikiId: newPageParentId === "root" ? null : newPageParentId,
        isWikiHome: newPageIsHome,
      };

      const res = await axiosClient.post("/documents/wiki", payload);
      const created = res.data;
      setNewPageModalOpen(false);
      setNewPageTitle("");
      setNewPageParentId("root");
      setNewPageIsHome(false);

      await fetchWikiPages();
      navigate(`/wiki/${projectId}/${created._id}`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create wiki page");
    }
  };

  // Move / Reparent Page
  const handleMovePage = async (e) => {
    e.preventDefault();
    if (!selectedPage) return;

    try {
      const payload = {
        parentWikiId: targetParentId === "root" ? null : targetParentId,
      };

      const res = await axiosClient.put(`/documents/wiki/${selectedPage._id}`, payload);
      setSelectedPage(res.data);
      setMoveModalOpen(false);
      await fetchWikiPages();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to move wiki page");
    }
  };

  // Delete wiki page
  const handleDeletePage = async () => {
    if (!selectedPage) return;
    if (
      !confirm(
        `Are you sure you want to delete "${selectedPage.title}"? Child pages will be safely reparented.`
      )
    )
      return;

    try {
      await axiosClient.delete(`/documents/wiki/${selectedPage._id}`);
      fetchWikiPages();
      navigate(`/wiki/${projectId}`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete wiki page");
    }
  };

  // Render recursive tree item
  const renderTreeItem = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node._id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedPage?._id === node._id;

    return (
      <div key={node._id} className="select-none">
        <div
          onClick={() => navigate(`/wiki/${projectId}/${node._id}`)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`flex items-center justify-between py-1.5 pr-2 rounded-lg text-xs font-medium cursor-pointer transition group ${
            isSelected
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node._id);
                }}
                className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
                  isSelected ? "text-white" : "text-slate-400"
                }`}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}

            {node.isWikiHome ? (
              <Home size={14} className={isSelected ? "text-white" : "text-amber-500 shrink-0"} />
            ) : (
              <FileText size={14} className={isSelected ? "text-white" : "text-indigo-400 shrink-0"} />
            )}

            <span className="truncate">{node.title}</span>
          </div>

          {node.isWikiHome && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                isSelected
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
              }`}
            >
              Home
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5 mt-0.5">
            {node.children.map((child) => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen app-bg flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between shadow-xs sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            to={projectId ? `/kanban/${projectId}` : "/projects"}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition"
          >
            <ChevronRight className="rotate-180 w-4 h-4" />
            Back to Project
          </Link>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {project?.name || "Project"} Wiki & Knowledge Base
              </h1>
              <p className="text-[11px] text-slate-500">
                Hierarchical team documentation, architecture guides, and specs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Autosave Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            {saveStatus === "saving" && (
              <>
                <Clock size={12} className="text-amber-500 animate-spin" />
                <span className="text-amber-500 text-[11px]">Saving...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-slate-600 dark:text-slate-400 text-[11px]">All saved</span>
              </>
            )}
            {saveStatus === "unsaved" && (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-500 text-[11px]">Unsaved</span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <AlertCircle size={12} className="text-rose-500" />
                <span className="text-rose-500 text-[11px]">Save failed</span>
              </>
            )}
          </div>

          {/* Collaborator Avatars */}
          {collaborators.length > 0 && (
            <div className="flex items-center -space-x-1.5 mr-1" title="Active collaborators">
              {collaborators.slice(0, 4).map((c, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: c.color }}
                  className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                  title={c.name}
                >
                  {c.name ? c.name[0].toUpperCase() : "U"}
                </div>
              ))}
              {collaborators.length > 4 && (
                <div className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-[9px] font-bold border-2 border-white dark:border-slate-900">
                  +{collaborators.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Linked Tasks Button (DOC-08) */}
          <button
            onClick={() => setLinkedTasksOpen(!linkedTasksOpen)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs font-semibold transition ${
              linkedTasksOpen
                ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Linked Tasks"
          >
            <CheckSquare size={14} className="text-indigo-500" />
            <span className="hidden sm:inline">Tasks</span>
          </button>

          {/* Action buttons */}
          <button
            onClick={() => setVersionModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Version History & Snapshots"
          >
            <History size={14} className="text-indigo-500" />
            <span className="hidden sm:inline">History</span>
          </button>

          <button
            onClick={() => setCommentsPanelOpen(!commentsPanelOpen)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs font-semibold transition ${
              commentsPanelOpen
                ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Discussions & Comments"
          >
            <MessageSquare size={14} />
            <span className="hidden sm:inline">Discussions</span>
            {comments.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-600 text-white text-[10px] rounded-full">
                {comments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShareModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Share & Page Permissions"
          >
            <Share2 size={14} className="text-indigo-500" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Wiki Hierarchy Sidebar */}
        <aside className="w-72 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex flex-col shrink-0">
          {/* Sidebar Top: Search & Create */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FolderTree size={14} className="text-indigo-500" />
                Pages ({wikiPages.length})
              </span>
              <button
                onClick={() => {
                  setNewPageParentId(selectedPage?._id || "root");
                  setNewPageModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-xs transition"
                title="Add New Wiki Page"
              >
                <Plus size={13} />
                New Page
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search wiki pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Tree Navigation Container */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loading ? (
              <div className="p-4 text-xs text-slate-400 text-center">Loading wiki tree...</div>
            ) : wikiTree.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700 stroke-[1.5]" />
                <p className="font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  No wiki pages found
                </p>
                <p className="text-[11px] mb-3">Create your first knowledge base article.</p>
                <button
                  onClick={() => setNewPageModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-medium text-xs shadow-xs"
                >
                  Create Page
                </button>
              </div>
            ) : (
              wikiTree.map((rootNode) => renderTreeItem(rootNode, 0))
            )}
          </div>

          {/* Sidebar Footer: Quick Links */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between text-slate-500">
            <Link
              to={`/documents/${projectId}`}
              className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition"
              title="Open Project File Documents"
            >
              <FileText size={13} />
              All Documents
            </Link>
            <span className="text-[11px] text-slate-400">DOC-07 Wiki</span>
          </div>
        </aside>

        {/* Wiki Article Viewer / Editor Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950 overflow-y-auto">
          {selectedPage ? (
            <div className="max-w-4xl w-full mx-auto p-6 sm:p-10 space-y-6">
              {/* Breadcrumb Path */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-900">
                <Link
                  to={`/wiki/${projectId}`}
                  className="inline-flex items-center gap-1 hover:text-indigo-600 transition font-medium"
                >
                  <Home size={13} />
                  Wiki Home
                </Link>

                {selectedPage.breadcrumbs &&
                  selectedPage.breadcrumbs.map((crumb) => (
                    <React.Fragment key={crumb._id}>
                      <ChevronRight size={13} className="text-slate-400" />
                      <button
                        onClick={() => navigate(`/wiki/${projectId}/${crumb._id}`)}
                        className={`truncate max-w-[150px] font-medium transition ${
                          selectedPage._id === crumb._id
                            ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                            : "hover:text-indigo-600"
                        }`}
                      >
                        {crumb.title}
                      </button>
                    </React.Fragment>
                  ))}
              </div>

              {/* Title & Metadata Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    {selectedPage.userPermission?.canEdit ? (
                      <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled Wiki Page"
                        className="w-full text-3xl font-extrabold text-slate-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 placeholder-slate-300 dark:placeholder-slate-700 tracking-tight"
                      />
                    ) : (
                      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {selectedPage.title}
                      </h1>
                    )}
                  </div>

                  {/* Actions Dropdown / Tools */}
                  <div className="flex items-center gap-2">
                    {selectedPage.userPermission?.canEdit && (
                      <button
                        onClick={() => {
                          setTargetParentId(selectedPage.parentWikiId?._id || "root");
                          setMoveModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                        title="Move / Reorder in Wiki Hierarchy"
                      >
                        <Move size={13} />
                        Move
                      </button>
                    )}

                    {selectedPage.userPermission?.canDelete && (
                      <button
                        onClick={handleDeletePage}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Delete Wiki Page"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subtitle / Author Info */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  {selectedPage.createdBy && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Authored by</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {selectedPage.createdBy.name}
                      </span>
                    </div>
                  )}

                  {selectedPage.updatedAt && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock size={12} />
                      <span>Updated {new Date(selectedPage.updatedAt).toLocaleDateString()}</span>
                    </div>
                  )}

                  {selectedPage.isWikiHome && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Home size={10} />
                      Project Wiki Landing Page
                    </span>
                  )}
                </div>
              </div>

              {/* TipTap Rich Text Editor */}
              <div className="pt-2">
                <TipTapEditor
                  key={`${selectedPage._id}_${collabSessionEpoch}`}
                  content={selectedPage.content}
                  editable={Boolean(selectedPage.userPermission?.canEdit)}
                  onUpdate={handleEditorUpdate}
                  ydoc={collabYDoc}
                  provider={collabProvider}
                />
              </div>

              {/* Child Sub-pages Navigation Panel */}
              {selectedPage.children && selectedPage.children.length > 0 && (
                <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <CornerDownRight size={14} className="text-indigo-500" />
                    Sub-pages in this topic ({selectedPage.children.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedPage.children.map((child) => (
                      <div
                        key={child._id}
                        onClick={() => navigate(`/wiki/${projectId}/${child._id}`)}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition shadow-xs flex items-start gap-2.5"
                      >
                        <FileText size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {child.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Updated {new Date(child.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <BookOpen size={48} className="text-slate-300 dark:text-slate-800 stroke-[1.5] mb-3" />
              <h2 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select or create a wiki page
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Browse documents in the knowledge base hierarchy from the sidebar or author a new
                spec.
              </p>
              <button
                onClick={() => setNewPageModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-md hover:bg-indigo-700 transition"
              >
                + New Wiki Page
              </button>
            </div>
          )}
        </main>

        {/* Discussions & Comments Drawer (DOC-05) */}
        {commentsPanelOpen && selectedPage && (
          <aside className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex flex-col shadow-lg z-10">
            <DocumentCommentsPanel
              documentId={selectedPage._id}
              canComment={Boolean(selectedPage.userPermission?.canComment)}
              onClose={() => setCommentsPanelOpen(false)}
            />
          </aside>
        )}

        {/* Linked Tasks Drawer (DOC-08) */}
        {linkedTasksOpen && selectedPage && (
          <LinkedTasksDrawer
            documentId={selectedPage._id}
            projectId={projectId}
            canEdit={Boolean(selectedPage.userPermission?.canEdit)}
            isOpen={linkedTasksOpen}
            onClose={() => setLinkedTasksOpen(false)}
          />
        )}
      </div>

      {/* New Wiki Page Modal */}
      {newPageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <BookOpen size={16} className="text-indigo-500" />
                Create Wiki Page
              </h3>
              <button
                onClick={() => setNewPageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePage} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Page Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. System Architecture, API Standards"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Parent Topic / Section
                </label>
                <select
                  value={newPageParentId}
                  onChange={(e) => setNewPageParentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="root">Top-Level (Root Wiki Page)</option>
                  {wikiPages.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.title} {p.isWikiHome ? "(Home)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="setWikiHomeCheckbox"
                  checked={newPageIsHome}
                  onChange={(e) => setNewPageIsHome(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="setWikiHomeCheckbox"
                  className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Set as Project Wiki Home page
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewPageModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Create Page
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move / Reparent Page Modal */}
      {moveModalOpen && selectedPage && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Move size={16} className="text-indigo-500" />
                Move "{selectedPage.title}"
              </h3>
              <button
                onClick={() => setMoveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMovePage} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Choose New Parent Topic
                </label>
                <select
                  value={targetParentId}
                  onChange={(e) => setTargetParentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="root">Top-Level (Root Wiki Page)</option>
                  {wikiPages
                    .filter((p) => p._id !== selectedPage._id)
                    .map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.title} {p.isWikiHome ? "(Home)" : ""}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Reparenting automatically updates breadcrumbs and sidebar nesting hierarchy.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMoveModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Save Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Modal (DOC-06) */}
      {versionModalOpen && selectedPage && (
        <DocumentVersionHistoryModal
          documentId={selectedPage._id}
          canEdit={Boolean(selectedPage.userPermission?.canEdit)}
          onClose={() => setVersionModalOpen(false)}
          onRestored={(restoredDoc) => {
            setSelectedPage(restoredDoc);
            setTitle(restoredDoc.title);
            contentRef.current = restoredDoc.content;
            setCollabSessionEpoch((prev) => prev + 1);
            setVersionModalOpen(false);
          }}
        />
      )}

      {/* Permissions / Share Modal (DOC-04) */}
      {shareModalOpen && selectedPage && (
        <DocumentShareModal
          document={selectedPage}
          onClose={() => setShareModalOpen(false)}
          onUpdate={(updatedDoc) => {
            setSelectedPage(updatedDoc);
          }}
        />
      )}
    </div>
  );
}

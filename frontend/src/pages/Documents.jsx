import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  FileText,
  Plus,
  Trash2,
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  MoreVertical,
  Share2,
  Users,
  Search,
  ArrowUpDown,
  Lock,
  Globe,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  Edit2,
  History,
  MessageSquare,
  BookOpen,
  CheckSquare,
} from "lucide-react";

export default function Documents() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.auth.user);

  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [projectTeamMembers, setProjectTeamMembers] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("all"); // 'all' | 'root' | folderId
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved' | 'saving' | 'unsaved' | 'error'
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Collaborator presence state
  const [collaborators, setCollaborators] = useState([]);
  const [collabYDoc, setCollabYDoc] = useState(null);
  const [collabProvider, setCollabProvider] = useState(null);
  // Session key to force clean provider & TipTap unmount/remount on authoritative restoration
  const [collabSessionEpoch, setCollabSessionEpoch] = useState(1);

  // Comments & Discussions State (DOC-05)
  const [comments, setComments] = useState([]);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState(null);

  // Version History State (DOC-06)
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  // Linked Tasks Drawer (DOC-08)
  const [linkedTasksOpen, setLinkedTasksOpen] = useState(false);

  // Modals State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6366f1");

  // Local draft states
  const [title, setTitle] = useState("");
  const contentRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Fetch project team members for sharing
  const fetchProjectTeamMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await axiosClient.get(`/projects/${projectId}/members`);
      setProjectTeamMembers(res.data || []);
    } catch (err) {
      console.error("Failed to load project team members:", err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectTeamMembers();
  }, [fetchProjectTeamMembers]);

  // Fetch Folders
  const fetchFolders = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await axiosClient.get(`/documents/folders/project/${projectId}`);
      setFolders(res.data || []);
    } catch (err) {
      console.error("Failed to fetch folders:", err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Fetch Documents
  const fetchDocuments = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await axiosClient.get(`/documents/project/${projectId}`, {
        params: {
          folderId: selectedFolderId,
          search: searchQuery,
          sortBy,
          sortOrder,
        },
      });
      const docs = res.data || [];
      setDocuments(docs);

      // Auto-select first doc if none selected or if selectedDoc was deleted
      if (docs.length > 0) {
        if (!selectedDoc || !docs.some((d) => d._id === selectedDoc._id)) {
          setSelectedDoc(docs[0]);
          setTitle(docs[0].title);
          contentRef.current = docs[0].content;
        }
      } else {
        setSelectedDoc(null);
        setTitle("");
        contentRef.current = null;
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedFolderId, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Fetch Comments for active document
  const fetchComments = useCallback(async () => {
    if (!selectedDoc?._id) return;
    try {
      const res = await axiosClient.get(`/documents/${selectedDoc._id}/comments`);
      setComments(res.data || []);
    } catch (err) {
      console.error("Failed to load document comments:", err);
    }
  }, [selectedDoc?._id]);

  useEffect(() => {
    if (selectedDoc?._id) {
      fetchComments();
    }
  }, [selectedDoc?._id, fetchComments]);

  // Setup real-time collaborative editing session when selectedDoc or session epoch changes
  useEffect(() => {
    if (!selectedDoc?._id) {
      setCollabYDoc(null);
      setCollabProvider(null);
      setCollaborators([]);
      return;
    }

    const ydoc = new Y.Doc();
    const provider = new CollabSocketProvider(selectedDoc._id, ydoc, {
      id: authUser?._id,
      name: authUser?.name || "Anonymous",
      email: authUser?.email,
      avatar: authUser?.avatar,
    });

    provider.onCollaboratorsChange = (updater) => {
      if (typeof updater === "function") {
        setCollaborators(updater);
      } else {
        setCollaborators(updater || []);
      }
    };

    // Handle authoritative server reset (e.g. Version restoration)
    provider.onDocumentReset = ({ doc: restoredDoc, epoch }) => {
      // Cancel any pending autosave timer immediately
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      setSaveStatus("saved");

      // Bump session epoch to trigger clean provider and TipTap remount
      setCollabSessionEpoch((prev) => (epoch ? epoch : prev + 1));
      if (restoredDoc) {
        setSelectedDoc((prev) => ({
          ...restoredDoc,
          userPermission: prev?.userPermission || restoredDoc.userPermission,
        }));
        setTitle(restoredDoc.title);
        contentRef.current = restoredDoc.content;
      }
    };

    setCollabYDoc(ydoc);
    setCollabProvider(provider);

    return () => {
      provider.destroy();
      ydoc.destroy();
      setCollabYDoc(null);
      setCollabProvider(null);
      setCollaborators([]);
    };
  }, [selectedDoc?._id, authUser, collabSessionEpoch]);

  // Socket.IO real-time project-level, comment, and version restore events
  useEffect(() => {
    if (!projectId) return;
    if (!socket.connected) socket.connect();

    socket.emit("joinProject", { projectId });

    const handleDocCreated = (newDoc) => {
      setDocuments((prev) => (prev.some((d) => d._id === newDoc._id) ? prev : [newDoc, ...prev]));
    };

    const handleDocUpdated = (updatedDoc) => {
      setDocuments((prev) =>
        prev.map((d) => (d._id === updatedDoc._id ? { ...d, ...updatedDoc } : d))
      );
      if (selectedDoc && selectedDoc._id === updatedDoc._id) {
        setSelectedDoc((prev) => ({
          ...updatedDoc,
          userPermission: prev?.userPermission || updatedDoc.userPermission,
        }));
      }
    };

    const handleDocDeleted = ({ documentId }) => {
      setDocuments((prev) => prev.filter((d) => d._id !== documentId));
      if (selectedDoc && selectedDoc._id === documentId) {
        setSelectedDoc(null);
        setTitle("");
        contentRef.current = null;
      }
    };

    const handleFolderCreated = (newFolder) => {
      setFolders((prev) => (prev.some((f) => f._id === newFolder._id) ? prev : [...prev, newFolder]));
    };

    const handleFolderUpdated = (updatedFolder) => {
      setFolders((prev) =>
        prev.map((f) => (f._id === updatedFolder._id ? updatedFolder : f))
      );
    };

    const handleFolderDeleted = ({ folderId }) => {
      setFolders((prev) => prev.filter((f) => f._id !== folderId));
      if (selectedFolderId === folderId) {
        setSelectedFolderId("all");
      }
    };

    const handleCommentAdded = (newComment) => {
      if (!selectedDoc || newComment.documentId !== selectedDoc._id) return;
      if (newComment.parentCommentId) {
        setComments((prev) =>
          prev.map((thread) =>
            thread._id === newComment.parentCommentId
              ? {
                  ...thread,
                  replies: [...(thread.replies || []), newComment],
                }
              : thread
          )
        );
      } else {
        setComments((prev) => [newComment, ...prev]);
      }
    };

    const handleCommentResolved = ({ commentId, isResolved, resolvedBy, resolvedAt }) => {
      setComments((prev) =>
        prev.map((thread) =>
          thread._id === commentId
            ? { ...thread, isResolved, resolvedBy, resolvedAt }
            : thread
        )
      );
    };

    const handleCommentDeleted = ({ commentId, parentCommentId }) => {
      setComments((prev) => {
        if (parentCommentId) {
          return prev.map((thread) =>
            thread._id === parentCommentId
              ? { ...thread, replies: (thread.replies || []).filter((r) => r._id !== commentId) }
              : thread
          );
        }
        return prev.filter((t) => t._id !== commentId);
      });
    };

    // Real-time version restoration event (DOC-06): cancel in-flight saves & trigger epoch remount
    const handleVersionRestored = ({ documentId: restDocId, epoch, doc: restoredDoc }) => {
      if (selectedDoc && selectedDoc._id === restDocId) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        setSaveStatus("saved");

        setCollabSessionEpoch((prev) => (epoch ? epoch : prev + 1));
        setSelectedDoc((prev) => ({
          ...restoredDoc,
          userPermission: prev?.userPermission || restoredDoc.userPermission,
        }));
        setTitle(restoredDoc.title);
        contentRef.current = restoredDoc.content;
      }
    };

    socket.on("documentCreated", handleDocCreated);
    socket.on("documentUpdated", handleDocUpdated);
    socket.on("documentDeleted", handleDocDeleted);
    socket.on("documentFolderCreated", handleFolderCreated);
    socket.on("documentFolderUpdated", handleFolderUpdated);
    socket.on("documentFolderDeleted", handleFolderDeleted);
    socket.on("docCommentAdded", handleCommentAdded);
    socket.on("docCommentResolved", handleCommentResolved);
    socket.on("docCommentDeleted", handleCommentDeleted);
    socket.on("docVersionRestored", handleVersionRestored);

    return () => {
      socket.off("documentCreated", handleDocCreated);
      socket.off("documentUpdated", handleDocUpdated);
      socket.off("documentDeleted", handleDocDeleted);
      socket.off("documentFolderCreated", handleFolderCreated);
      socket.off("documentFolderUpdated", handleFolderUpdated);
      socket.off("documentFolderDeleted", handleFolderDeleted);
      socket.off("docCommentAdded", handleCommentAdded);
      socket.off("docCommentResolved", handleCommentResolved);
      socket.off("docCommentDeleted", handleCommentDeleted);
      socket.off("docVersionRestored", handleVersionRestored);
      socket.emit("leaveProject", { projectId });
    };
  }, [projectId, selectedDoc, selectedFolderId, fetchDocuments]);

  // Debounced Autosave (strictly disabled if canEdit is false)
  const canEditCurrentDoc = selectedDoc?.userPermission?.canEdit ?? true;
  const canCommentCurrentDoc = selectedDoc?.userPermission?.canComment ?? true;
  const isOwnerCurrentDoc = selectedDoc?.userPermission?.canManagePermissions ?? false;

  const triggerAutosave = useCallback(
    (newTitle, newContent, newHtml) => {
      if (!selectedDoc || !canEditCurrentDoc) return;
      setSaveStatus("unsaved");

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          setSaving(true);
          setSaveStatus("saving");

          const res = await axiosClient.put(`/documents/${selectedDoc._id}`, {
            title: newTitle !== undefined ? newTitle : title,
            content: newContent !== undefined ? newContent : contentRef.current,
            contentHtml: newHtml,
          });

          setSelectedDoc((prev) => ({
            ...res.data,
            userPermission: prev?.userPermission || res.data.userPermission,
          }));
          setSaveStatus("saved");
        } catch (err) {
          console.error("Autosave failed:", err);
          setSaveStatus("error");
        } finally {
          setSaving(false);
        }
      }, 1200);
    },
    [selectedDoc, canEditCurrentDoc, title]
  );

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    triggerAutosave(val, contentRef.current);
  };

  const handleEditorChange = ({ json, html }) => {
    contentRef.current = json;
    triggerAutosave(title, json, html);
  };

  // Create new document
  const handleCreateDocument = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.post("/documents", {
        projectId,
        title: "Untitled Document",
        folderId: selectedFolderId === "all" || selectedFolderId === "root" ? null : selectedFolderId,
        content: { type: "doc", content: [{ type: "paragraph", content: [] }] },
        contentHtml: "<p></p>",
      });

      const newDoc = res.data;
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDoc(newDoc);
      setTitle(newDoc.title);
      contentRef.current = newDoc.content;
    } catch (err) {
      console.error("Failed to create document:", err);
    } finally {
      setLoading(false);
    }
  };

  // Create new folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await axiosClient.post("/documents/folders", {
        projectId,
        name: newFolderName.trim(),
        color: newFolderColor,
      });

      setFolders((prev) => [...prev, res.data]);
      setNewFolderName("");
      setCreateFolderModalOpen(false);
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  // Handle inline comment submission
  const handleAddComment = async ({ text, anchor, parentCommentId }) => {
    if (!selectedDoc || !canCommentCurrentDoc) return;
    try {
      const res = await axiosClient.post(`/documents/${selectedDoc._id}/comments`, {
        projectId,
        parentCommentId: parentCommentId || null,
        text,
        anchor,
      });

      const newComment = res.data;
      if (parentCommentId) {
        setComments((prev) =>
          prev.map((thread) =>
            thread._id === parentCommentId
              ? { ...thread, replies: [...(thread.replies || []), newComment] }
              : thread
          )
        );
      } else {
        setComments((prev) => [newComment, ...prev]);
      }
      setActiveAnchor(null);
    } catch (err) {
      console.error("Failed to submit comment:", err);
    }
  };

  // Handle comment resolution toggle
  const handleToggleResolve = async (commentId) => {
    try {
      const res = await axiosClient.patch(`/documents/comments/${commentId}/resolve`);
      setComments((prev) =>
        prev.map((t) => (t._id === commentId ? { ...t, ...res.data } : t))
      );
    } catch (err) {
      console.error("Failed to toggle resolve:", err);
    }
  };

  // Handle comment deletion
  const handleDeleteComment = async (commentId, parentCommentId) => {
    try {
      await axiosClient.delete(`/documents/comments/${commentId}`);
      setComments((prev) => {
        if (parentCommentId) {
          return prev.map((t) =>
            t._id === parentCommentId
              ? { ...t, replies: (t.replies || []).filter((r) => r._id !== commentId) }
              : t
          );
        }
        return prev.filter((t) => t._id !== commentId);
      });
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  // Delete document
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await axiosClient.delete(`/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      if (selectedDoc?._id === docId) {
        const remaining = documents.filter((d) => d._id !== docId);
        if (remaining.length > 0) {
          setSelectedDoc(remaining[0]);
          setTitle(remaining[0].title);
          contentRef.current = remaining[0].content;
        } else {
          setSelectedDoc(null);
          setTitle("");
          contentRef.current = null;
        }
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
      {/* Sidebar: Navigation, Folders & Documents Tree */}
      <div className="w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full shadow-xs">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-base tracking-tight">Documents</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(`/wiki/${projectId}`)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Project Wiki & Knowledge Base"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCreateFolderModalOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              onClick={handleCreateDocument}
              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1 shadow-xs"
              title="New Document"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
              >
                <option value="updatedAt">Updated</option>
                <option value="createdAt">Created</option>
                <option value="title">Title</option>
              </select>
            </div>

            <button
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="hover:text-indigo-600 transition uppercase font-semibold text-[10px]"
            >
              {sortOrder}
            </button>
          </div>
        </div>

        {/* Folders List */}
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-2">
            Folders
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedFolderId("all")}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                selectedFolderId === "all"
                  ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>All Documents</span>
            </button>

            <button
              onClick={() => setSelectedFolderId("root")}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                selectedFolderId === "root"
                  ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Unfiled (Root)</span>
            </button>

            {folders.map((folder) => (
              <button
                key={folder._id}
                onClick={() => setSelectedFolderId(folder._id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                  selectedFolderId === folder._id
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: folder.color || "#6366f1" }}
                  />
                  <span className="truncate">{folder.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Document Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {documents.map((doc) => {
            const isSelected = selectedDoc?._id === doc._id;
            return (
              <div
                key={doc._id}
                onClick={() => {
                  setSelectedDoc(doc);
                  setTitle(doc.title);
                  contentRef.current = doc.content;
                }}
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition border ${
                  isSelected
                    ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200"
                    : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="flex items-start gap-2.5 truncate">
                  <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                  <div className="truncate">
                    <h4 className="text-xs font-semibold truncate leading-tight">
                      {doc.title || "Untitled Document"}
                    </h4>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc._id);
                    }}
                    className="p-1 rounded-md hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-slate-400"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Document Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
        {/* Top Navbar */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-amber-500 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Saving...</span>
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </span>
              )}
              {saveStatus === "unsaved" && (
                <span className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Unsaved changes</span>
                </span>
              )}
            </div>

            {/* Read-Only Badge */}
            {!canEditCurrentDoc && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                View Only
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Active Collaborators Presence Avatars */}
            {collaborators.length > 0 && (
              <div className="flex items-center -space-x-1.5 mr-2">
                {collaborators.map((c) => (
                  <div
                    key={c.socketId}
                    className="relative group cursor-pointer"
                    title={`${c.name} (${c.role})`}
                  >
                    {c.avatar ? (
                      <img
                        src={c.avatar}
                        alt={c.name}
                        className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 object-cover"
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                        style={{ backgroundColor: c.color || "#6366f1" }}
                      >
                        {c.name ? c.name.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Linked Tasks Button (DOC-08) */}
            {selectedDoc && (
              <button
                onClick={() => setLinkedTasksOpen(!linkedTasksOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition border ${
                  linkedTasksOpen
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                }`}
                title="Linked Tasks"
              >
                <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                <span>Tasks</span>
              </button>
            )}

            {/* Version History Button (DOC-06) */}
            {selectedDoc && (
              <button
                onClick={() => setVersionModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition border bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                title="View Version History & Recovery"
              >
                <History className="w-3.5 h-3.5 text-indigo-500" />
                <span>History</span>
              </button>
            )}

            {/* Discussions Button */}
            {selectedDoc && (
              <button
                onClick={() => setCommentsPanelOpen(!commentsPanelOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition border ${
                  commentsPanelOpen
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                }`}
                title="Comments & Discussions"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Discussions</span>
                {comments.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500 text-white">
                    {comments.length}
                  </span>
                )}
              </button>
            )}

            {/* Share & Permissions Button */}
            {selectedDoc && (
              <button
                onClick={() => setShareModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            )}

            <ThemeToggle />
          </div>
        </div>

        {/* Editor & Content Canvas Container */}
        {selectedDoc ? (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full space-y-4">
              {/* Document Title Input */}
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                disabled={!canEditCurrentDoc}
                placeholder="Untitled Document"
                className={`w-full text-3xl font-extrabold bg-transparent border-b border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:outline-hidden pb-2 tracking-tight transition ${
                  canEditCurrentDoc
                    ? "text-slate-900 dark:text-white"
                    : "cursor-default"
                }`}
              />

              {/* Collaborative Rich Text Editor with Session Epoch Key */}
              <TipTapEditor
                key={`${selectedDoc._id}_${collabSessionEpoch}`}
                content={selectedDoc.content}
                readOnly={!canEditCurrentDoc}
                onChange={handleEditorChange}
                ydoc={collabYDoc}
                provider={collabProvider}
                user={{
                  id: authUser?._id,
                  name: authUser?.name || "Anonymous",
                  email: authUser?.email,
                  avatar: authUser?.avatar,
                }}
              />
            </div>

            {/* Comments Panel Sidebar */}
            {commentsPanelOpen && (
              <DocumentCommentsPanel
                isOpen={commentsPanelOpen}
                onClose={() => setCommentsPanelOpen(false)}
                documentId={selectedDoc._id}
                comments={comments}
                activeAnchor={activeAnchor}
                canComment={canCommentCurrentDoc}
                currentUser={authUser}
                onAddComment={handleAddComment}
                onToggleResolve={handleToggleResolve}
                onDeleteComment={handleDeleteComment}
              />
            )}

            {/* Linked Tasks Drawer (DOC-08) */}
            {linkedTasksOpen && (
              <LinkedTasksDrawer
                documentId={selectedDoc._id}
                projectId={projectId}
                canEdit={canEditCurrentDoc}
                isOpen={linkedTasksOpen}
                onClose={() => setLinkedTasksOpen(false)}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <FileText className="w-12 h-12 stroke-1 mb-3 text-slate-300 dark:text-slate-700" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">
              No Document Selected
            </h3>
            <p className="text-xs max-w-sm mb-4">
              Choose an existing document from the sidebar or create a new one to start writing.
            </p>
            <button
              onClick={handleCreateDocument}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Document</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal: Version History & Recovery (DOC-06) */}
      {versionModalOpen && selectedDoc && (
        <DocumentVersionHistoryModal
          isOpen={versionModalOpen}
          onClose={() => setVersionModalOpen(false)}
          document={selectedDoc}
          canEdit={canEditCurrentDoc}
          onVersionRestored={(restoredDoc) => {
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
              saveTimeoutRef.current = null;
            }
            setSaveStatus("saved");
            setCollabSessionEpoch((prev) => prev + 1);

            setSelectedDoc((prev) => ({
              ...restoredDoc,
              userPermission: prev?.userPermission || restoredDoc.userPermission,
            }));
            setTitle(restoredDoc.title);
            contentRef.current = restoredDoc.content;
            setDocuments((prev) =>
              prev.map((d) => (d._id === restoredDoc._id ? restoredDoc : d))
            );
          }}
        />
      )}

      {/* Modal: Share & Permissions */}
      {shareModalOpen && selectedDoc && (
        <DocumentShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          document={selectedDoc}
          teamMembers={projectTeamMembers}
          onDocumentUpdated={(updatedDoc) => {
            setSelectedDoc((prev) => ({
              ...updatedDoc,
              userPermission: prev?.userPermission || updatedDoc.userPermission,
            }));
            setDocuments((prev) =>
              prev.map((d) => (d._id === updatedDoc._id ? updatedDoc : d))
            );
          }}
        />
      )}

      {/* Modal: Create Folder */}
      {createFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              Create Document Folder
            </h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Design Specs, Engineering Docs"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Folder Color
                </label>
                <div className="flex items-center gap-2">
                  {["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewFolderColor(color)}
                      className={`w-6 h-6 rounded-full transition ${
                        newFolderColor === color ? "ring-2 ring-offset-2 ring-indigo-500 scale-110" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateFolderModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition shadow-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

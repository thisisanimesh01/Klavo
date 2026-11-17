import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import * as Y from "yjs";
import axiosClient from "../api/axiosClient";
import TipTapEditor from "../components/TipTapEditor";
import ThemeToggle from "../components/ThemeToggle";
import DocumentShareModal from "../components/DocumentShareModal";
import DocumentCommentsPanel from "../components/DocumentCommentsPanel";
import { CollabSocketProvider } from "../utils/collabSocketProvider";
import socket from "../socket";
import {
  FileText,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Clock,
  Search,
  ArrowLeft,
  Share2,
  BookOpen,
  Calendar,
  AlertCircle,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  Folder,
  MoveRight,
  ArrowUpDown,
  Home,
  SlidersHorizontal,
  X,
  Edit2,
  Users,
  Eye,
  Shield,
  Crown,
  MessageSquare,
} from "lucide-react";

export default function Documents() {
  const { projectId, documentId } = useParams();
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

  // Comments & Discussions State (DOC-05)
  const [comments, setComments] = useState([]);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState(null);

  // Modals State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6366f1");
  const [moveDocModalOpen, setMoveDocModalOpen] = useState(false);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState("root");

  // Editor Draft State
  const [title, setTitle] = useState("");
  const contentRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Fetch all documents for project
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get(`/documents/project/${projectId}`, {
        params: {
          sortBy,
          sortOrder,
          folderId: selectedFolderId,
        },
      });
      const list = res.data || [];
      setDocuments(list);

      // If documentId specified in route, select it
      if (documentId) {
        const found = list.find((d) => d._id === documentId);
        if (found) {
          setSelectedDoc(found);
          setTitle(found.title);
          contentRef.current = found.content;
        }
      } else if (list.length > 0 && !selectedDoc) {
        setSelectedDoc(list[0]);
        setTitle(list[0].title);
        contentRef.current = list[0].content;
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, documentId, selectedFolderId, sortBy, sortOrder]);

  // Fetch folders for project
  const fetchFolders = useCallback(async () => {
    try {
      const res = await axiosClient.get(`/documents/folders/project/${projectId}`);
      setFolders(res.data || []);
    } catch (err) {
      console.error("Failed to fetch folders:", err);
    }
  }, [projectId]);

  // Fetch project team members for sharing and mentions
  const fetchProjectTeam = useCallback(async () => {
    try {
      const projectRes = await axiosClient.get(`/projects/${projectId}`);
      const teamId = projectRes.data?.teamId?._id || projectRes.data?.teamId;
      if (teamId) {
        const teamRes = await axiosClient.get(`/teams/${teamId}`);
        const members = teamRes.data?.members || [];
        const owner = teamRes.data?.owner;
        const allMembers = owner && !members.some((m) => m._id === owner._id) ? [owner, ...members] : members;
        setProjectTeamMembers(allMembers);
      }
    } catch (err) {
      console.error("Failed to fetch project team members:", err);
    }
  }, [projectId]);

  // Fetch comments for selected document
  const fetchComments = useCallback(async () => {
    if (!selectedDoc?._id) {
      setComments([]);
      return;
    }
    try {
      const res = await axiosClient.get(`/documents/${selectedDoc._id}/comments`);
      setComments(res.data || []);
    } catch (err) {
      console.error("Failed to fetch document comments:", err);
    }
  }, [selectedDoc?._id]);

  useEffect(() => {
    if (projectId) {
      fetchDocuments();
      fetchFolders();
      fetchProjectTeam();
    }
  }, [projectId, fetchDocuments, fetchFolders, fetchProjectTeam]);

  useEffect(() => {
    if (selectedDoc?._id) {
      fetchComments();
    }
  }, [selectedDoc?._id, fetchComments]);

  // Setup real-time collaborative editing session when selectedDoc changes
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

    setCollabYDoc(ydoc);
    setCollabProvider(provider);

    return () => {
      provider.destroy();
      ydoc.destroy();
      setCollabYDoc(null);
      setCollabProvider(null);
      setCollaborators([]);
    };
  }, [selectedDoc?._id, authUser]);

  // Socket.IO real-time project-level & document comment events
  useEffect(() => {
    if (!projectId) return;
    if (!socket.connected) socket.connect();

    socket.emit("joinProject", { projectId });

    const handleDocCreated = (newDoc) => {
      setDocuments((prev) => (prev.some((d) => d._id === newDoc._id) ? prev : [newDoc, ...prev]));
    };

    const handleDocUpdated = (updatedDoc) => {
      setDocuments((prev) =>
        prev.map((d) => (d._id === updatedDoc._id ? updatedDoc : d))
      );
      if (selectedDoc && selectedDoc._id === updatedDoc._id) {
        setSelectedDoc((prev) => ({
          ...updatedDoc,
          userPermission: prev?.userPermission || updatedDoc.userPermission,
        }));
      }
    };

    const handleDocDeleted = ({ documentId: delId }) => {
      setDocuments((prev) => prev.filter((d) => d._id !== delId));
      if (selectedDoc && selectedDoc._id === delId) {
        setSelectedDoc(null);
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

    const handleFolderDeleted = ({ folderId: delFolderId }) => {
      setFolders((prev) => prev.filter((f) => f._id !== delFolderId));
      if (selectedFolderId === delFolderId) {
        setSelectedFolderId("all");
      }
      fetchDocuments();
    };

    // Real-time comment event handlers (DOC-05)
    const handleCommentAdded = (newComment) => {
      if (newComment.documentId?.toString() !== selectedDoc?._id?.toString()) return;

      setComments((prev) => {
        if (newComment.parentCommentId) {
          // Reply added
          return prev.map((thread) => {
            if (thread._id === newComment.parentCommentId) {
              const replies = thread.replies || [];
              if (replies.some((r) => r._id === newComment._id)) return thread;
              return { ...thread, replies: [...replies, newComment] };
            }
            return thread;
          });
        }
        // Top-level thread added
        if (prev.some((t) => t._id === newComment._id)) return prev;
        return [...prev, { ...newComment, replies: [] }];
      });
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
          // Remove reply from thread
          return prev.map((thread) =>
            thread._id === parentCommentId
              ? { ...thread, replies: (thread.replies || []).filter((r) => r._id !== commentId) }
              : thread
          );
        }
        // Remove root thread
        return prev.filter((t) => t._id !== commentId);
      });
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
    [selectedDoc, title, canEditCurrentDoc]
  );

  const handleTitleChange = (e) => {
    if (!canEditCurrentDoc) return;
    const val = e.target.value;
    setTitle(val);
    triggerAutosave(val, contentRef.current);
  };

  const handleEditorChange = ({ json, html }) => {
    if (!canEditCurrentDoc) return;
    contentRef.current = json;
    triggerAutosave(title, json, html);
  };

  // Create new document
  const handleCreateDocument = async () => {
    try {
      const payload = {
        title: "Untitled Document",
        projectId,
        folderId: selectedFolderId !== "all" && selectedFolderId !== "root" ? selectedFolderId : null,
      };
      const res = await axiosClient.post("/documents", payload);
      setDocuments((prev) => [res.data, ...prev]);
      setSelectedDoc(res.data);
      setTitle(res.data.title);
      contentRef.current = res.data.content;
      navigate(`/projects/${projectId}/documents/${res.data._id}`);
    } catch (err) {
      console.error("Failed to create document:", err);
    }
  };

  // Delete current document
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await axiosClient.delete(`/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      if (selectedDoc && selectedDoc._id === docId) {
        const remaining = documents.filter((d) => d._id !== docId);
        if (remaining.length > 0) {
          setSelectedDoc(remaining[0]);
          setTitle(remaining[0].title);
          contentRef.current = remaining[0].content;
        } else {
          setSelectedDoc(null);
          setTitle("");
        }
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
      alert(err.response?.data?.message || "Failed to delete document");
    }
  };

  // Comments Actions (DOC-05)
  const handleCreateComment = async ({ text, parentCommentId, anchor }) => {
    if (!selectedDoc?._id) return;
    try {
      const res = await axiosClient.post(`/documents/${selectedDoc._id}/comments`, {
        text,
        parentCommentId,
        anchor,
      });

      // Update state locally
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
        setComments((prev) => [...prev, { ...newComment, replies: [] }]);
      }
    } catch (err) {
      console.error("Failed to create comment:", err);
      alert(err.response?.data?.message || "Failed to post comment");
    }
  };

  const handleResolveComment = async (commentId, isResolved) => {
    try {
      const res = await axiosClient.patch(`/documents/comments/${commentId}/resolve`, {
        isResolved,
      });
      setComments((prev) =>
        prev.map((thread) =>
          thread._id === commentId ? { ...thread, ...res.data } : thread
        )
      );
    } catch (err) {
      console.error("Failed to toggle resolve comment:", err);
      alert(err.response?.data?.message || "Failed to resolve comment");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await axiosClient.delete(`/documents/comments/${commentId}`);
      setComments((prev) =>
        prev
          .filter((t) => t._id !== commentId)
          .map((t) => ({
            ...t,
            replies: (t.replies || []).filter((r) => r._id !== commentId),
          }))
      );
    } catch (err) {
      console.error("Failed to delete comment:", err);
      alert(err.response?.data?.message || "Failed to delete comment");
    }
  };

  // Create new folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await axiosClient.post("/documents/folders", {
        name: newFolderName.trim(),
        projectId,
        color: newFolderColor,
      });
      setFolders((prev) => [...prev, res.data]);
      setNewFolderName("");
      setCreateFolderModalOpen(false);
      setSelectedFolderId(res.data._id);
    } catch (err) {
      console.error("Failed to create folder:", err);
      alert(err.response?.data?.message || "Failed to create folder");
    }
  };

  // Move document into a folder
  const handleMoveDocument = async () => {
    if (!selectedDoc) return;
    try {
      const folderVal = targetMoveFolderId === "root" ? null : targetMoveFolderId;
      const res = await axiosClient.put(`/documents/${selectedDoc._id}`, {
        folderId: folderVal,
      });
      setSelectedDoc(res.data);
      setDocuments((prev) => prev.map((d) => (d._id === res.data._id ? res.data : d)));
      setMoveDocModalOpen(false);
      fetchFolders();
    } catch (err) {
      console.error("Failed to move document:", err);
      alert(err.response?.data?.message || "Failed to move document");
    }
  };

  // Delete folder
  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm("Delete this folder? Contained documents will safely move to Root.")) return;
    try {
      await axiosClient.delete(`/documents/folders/${folderId}`);
      setFolders((prev) => prev.filter((f) => f._id !== folderId));
      if (selectedFolderId === folderId) {
        setSelectedFolderId("all");
      }
      fetchDocuments();
    } catch (err) {
      console.error("Failed to delete folder:", err);
      alert(err.response?.data?.message || "Failed to delete folder");
    }
  };

  // Capture mouse selection to enable inline comment anchor
  const handleEditorSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      setActiveAnchor({
        selectedText: sel.toString().trim(),
      });
      setCommentsPanelOpen(true);
    }
  };

  // Filtered documents list
  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      // Folder filtering
      if (selectedFolderId === "root" && d.folderId) return false;
      if (selectedFolderId !== "all" && selectedFolderId !== "root") {
        const docFid = d.folderId?._id || d.folderId;
        if (docFid !== selectedFolderId) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = d.title.toLowerCase().includes(query);
        const matchDesc = (d.description || "").toLowerCase().includes(query);
        return matchTitle || matchDesc;
      }
      return true;
    });
  }, [documents, selectedFolderId, searchQuery]);

  // Document count per folder
  const folderCounts = useMemo(() => {
    const counts = { all: documents.length, root: 0 };
    documents.forEach((d) => {
      if (!d.folderId) {
        counts.root = (counts.root || 0) + 1;
      } else {
        const fId = d.folderId?._id || d.folderId;
        counts[fId] = (counts[fId] || 0) + 1;
      }
    });
    return counts;
  }, [documents]);

  const userRole = selectedDoc?.userPermission?.role || "viewer";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Header Bar */}
      <div className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}/board`)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Back to Board"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Project Documents
            </h1>
          </div>
        </div>

        {/* Action Controls & Collaborators */}
        <div className="flex items-center gap-3">
          {/* Active Collaborators Presence Bar */}
          {selectedDoc && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-full border border-slate-200 dark:border-slate-700/60 text-xs">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <div className="flex items-center -space-x-1.5 overflow-hidden">
                {collaborators.map((c, i) => (
                  <div
                    key={c.socketId || i}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-white dark:border-slate-900 shadow-xs"
                    style={{ backgroundColor: c.color || "#6366f1" }}
                    title={`${c.name} (${c.role || "collaborator"})`}
                  >
                    {c.name ? c.name.charAt(0).toUpperCase() : "U"}
                  </div>
                ))}
              </div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 ml-1">
                {collaborators.length > 0 ? `${collaborators.length} active` : "1 editor"}
              </span>
            </div>
          )}

          {/* User Document Role Badge */}
          {selectedDoc && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 capitalize">
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <span>{userRole}</span>
            </div>
          )}

          {/* Discussions Button */}
          {selectedDoc && (
            <button
              onClick={() => setCommentsPanelOpen(!commentsPanelOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition border ${
                commentsPanelOpen
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
              title="Toggle Discussion Panel"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments</span>
              {comments.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  commentsPanelOpen ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
                  {comments.length}
                </span>
              )}
            </button>
          )}

          {/* Autosave Status Pill (shown only when user has edit permissions) */}
          {selectedDoc && canEditCurrentDoc && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {saveStatus === "saving" && (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span>Saving...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Saved</span>
                </>
              )}
              {saveStatus === "unsaved" && (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Unsaved changes</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-red-500 font-medium">Error saving</span>
                </>
              )}
            </div>
          )}

          {/* Share Button (opens permission management modal) */}
          {selectedDoc && (
            <button
              onClick={() => setShareModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-200 dark:border-slate-700"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Share</span>
            </button>
          )}

          <button
            onClick={handleCreateDocument}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Doc</span>
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Folder & Document Navigation */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
          {/* Search & Sort Controls */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                >
                  <option value="updatedAt">Updated</option>
                  <option value="title">Title</option>
                  <option value="createdAt">Created</option>
                </select>
              </div>

              <button
                onClick={() => setCreateFolderModalOpen(true)}
                className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                <FolderPlus className="w-3 h-3" />
                <span>New Folder</span>
              </button>
            </div>
          </div>

          {/* Folder Pills Horizontal Bar */}
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
            <button
              onClick={() => setSelectedFolderId("all")}
              className={`px-2.5 py-1 rounded-lg shrink-0 transition flex items-center gap-1.5 ${
                selectedFolderId === "all"
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <span>All</span>
              <span className="text-[10px] opacity-75">({folderCounts.all})</span>
            </button>

            <button
              onClick={() => setSelectedFolderId("root")}
              className={`px-2.5 py-1 rounded-lg shrink-0 transition flex items-center gap-1.5 ${
                selectedFolderId === "root"
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Home className="w-3 h-3" />
              <span>Root</span>
              <span className="text-[10px] opacity-75">({folderCounts.root || 0})</span>
            </button>

            {folders.map((folder) => {
              const count = folderCounts[folder._id] || 0;
              const isSelected = selectedFolderId === folder._id;
              return (
                <div
                  key={folder._id}
                  className={`group px-2.5 py-1 rounded-lg shrink-0 transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white font-semibold shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <button
                    onClick={() => setSelectedFolderId(folder._id)}
                    className="flex items-center gap-1.5"
                  >
                    <Folder
                      className="w-3 h-3"
                      style={{ color: isSelected ? "white" : folder.color || "#6366f1" }}
                    />
                    <span className="truncate max-w-[90px]">{folder.name}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder._id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition"
                    title="Delete Folder"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading documents...</div>
            ) : filteredDocuments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                <p>No documents found in this view.</p>
                <button
                  onClick={handleCreateDocument}
                  className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold rounded-lg hover:underline"
                >
                  Create one now
                </button>
              </div>
            ) : (
              filteredDocuments.map((doc) => {
                const isSelected = selectedDoc?._id === doc._id;
                const canDelete = doc.userPermission?.canDelete;
                return (
                  <div
                    key={doc._id}
                    onClick={() => {
                      setSelectedDoc(doc);
                      setTitle(doc.title);
                      contentRef.current = doc.content;
                      navigate(`/projects/${projectId}/documents/${doc._id}`);
                    }}
                    className={`group w-full text-left p-3 rounded-xl transition flex flex-col gap-1 cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 shadow-xs"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <FileText
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected
                              ? "text-indigo-600 dark:text-indigo-400 font-bold"
                              : "text-slate-400"
                          }`}
                        />
                        <span
                          className={`text-xs truncate ${
                            isSelected
                              ? "font-bold text-indigo-900 dark:text-indigo-200"
                              : "font-medium text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {doc.title || "Untitled Document"}
                        </span>
                      </div>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc._id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-slate-400 transition"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {doc.description && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 pl-5.5">
                        {doc.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 pl-5.5 pt-0.5">
                      <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                      {doc.folderId && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <span>•</span>
                          <Folder className="w-2.5 h-2.5" />
                          <span>{doc.folderId.name || "Folder"}</span>
                        </span>
                      )}
                      {doc.userPermission?.role && (
                        <span className="text-[10px] uppercase font-semibold text-indigo-500 dark:text-indigo-400">
                          • {doc.userPermission.role}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Editor Area */}
        <div
          className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full"
          onMouseUp={handleEditorSelection}
        >
          {selectedDoc ? (
            <div className="space-y-6">
              {/* Document Breadcrumb & Folder Actions */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span
                    onClick={() => setSelectedFolderId("all")}
                    className="hover:text-indigo-600 cursor-pointer"
                  >
                    Documents
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                  {selectedDoc.folderId ? (
                    <span
                      onClick={() => setSelectedFolderId(selectedDoc.folderId._id)}
                      className="font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer flex items-center gap-1"
                    >
                      <Folder className="w-3 h-3 text-indigo-500" />
                      {selectedDoc.folderId.name}
                    </span>
                  ) : (
                    <span className="text-slate-500">Root / Unfiled</span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {title || "Untitled Document"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedDoc.userPermission?.canEdit && (
                    <button
                      onClick={() => {
                        setTargetMoveFolderId(selectedDoc.folderId?._id || "root");
                        setMoveDocModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                      title="Move to another folder"
                    >
                      <MoveRight className="w-3.5 h-3.5 text-slate-400" />
                      <span>Move</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Read-Only Notice Banner if viewer / commenter */}
              {!canEditCurrentDoc && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <Eye className="w-4 h-4 shrink-0" />
                  <span>
                    You have <strong>{userRole}</strong> access to this document. Editing is restricted.
                  </span>
                </div>
              )}

              {/* Document Title Header */}
              <input
                type="text"
                value={title}
                readOnly={!canEditCurrentDoc}
                onChange={handleTitleChange}
                placeholder="Untitled Document"
                className={`w-full text-3xl font-extrabold tracking-tight bg-transparent text-slate-900 dark:text-white border-b border-transparent pb-2 transition ${
                  canEditCurrentDoc
                    ? "hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-hidden"
                    : "cursor-default"
                }`}
              />

              {/* Collaborative Rich Text Editor */}
              <TipTapEditor
                key={selectedDoc._id}
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
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <BookOpen className="w-16 h-16 text-slate-300 dark:text-slate-700" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Select a document to edit
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Collaborate in real time with teammates, format rich content with TipTap, and organize your files.
                </p>
              </div>
              <button
                onClick={handleCreateDocument}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Document</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Collapsible Comments & Discussions Panel (DOC-05) */}
        {commentsPanelOpen && selectedDoc && (
          <DocumentCommentsPanel
            isOpen={commentsPanelOpen}
            onClose={() => setCommentsPanelOpen(false)}
            comments={comments}
            onCreateComment={handleCreateComment}
            onResolveComment={handleResolveComment}
            onDeleteComment={handleDeleteComment}
            projectTeamMembers={projectTeamMembers}
            currentUser={authUser}
            canComment={canCommentCurrentDoc}
            isOwner={isOwnerCurrentDoc}
            activeAnchor={activeAnchor}
            onClearActiveAnchor={() => setActiveAnchor(null)}
          />
        )}
      </div>

      {/* Modal: Share & Permissions */}
      {shareModalOpen && selectedDoc && (
        <DocumentShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          document={selectedDoc}
          projectTeamMembers={projectTeamMembers}
          currentUser={authUser}
          onUpdateDocument={(updated) => {
            setSelectedDoc(updated);
            setDocuments((prev) =>
              prev.map((d) => (d._id === updated._id ? updated : d))
            );
          }}
        />
      )}

      {/* Modal: Create Folder */}
      {createFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-500" />
                Create New Folder
              </h3>
              <button
                onClick={() => setCreateFolderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design Specs, Sprint 1 Docs..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Folder Color Accent
                </label>
                <div className="flex items-center gap-2">
                  {["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setNewFolderColor(hex)}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        newFolderColor === hex ? "border-slate-900 dark:border-white scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateFolderModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Move Document into Folder */}
      {moveDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MoveRight className="w-4 h-4 text-indigo-500" />
                Move Document
              </h3>
              <button
                onClick={() => setMoveDocModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select destination folder for <strong>"{selectedDoc?.title}"</strong>:
            </p>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              <button
                type="button"
                onClick={() => setTargetMoveFolderId("root")}
                className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-xs transition text-left ${
                  targetMoveFolderId === "root"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <Home className="w-4 h-4 text-slate-400" />
                <span>Root / Unfiled</span>
              </button>

              {folders.map((folder) => (
                <button
                  key={folder._id}
                  type="button"
                  onClick={() => setTargetMoveFolderId(folder._id)}
                  className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-xs transition text-left ${
                    targetMoveFolderId === folder._id
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Folder className="w-4 h-4" style={{ color: folder.color || "#6366f1" }} />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setMoveDocModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMoveDocument}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

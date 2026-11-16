import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import TipTapEditor from "../components/TipTapEditor";
import ThemeToggle from "../components/ThemeToggle";
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
} from "lucide-react";

export default function Documents() {
  const { projectId, documentId } = useParams();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("all"); // 'all' | 'root' | folderId
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved' | 'saving' | 'unsaved' | 'error'
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Folder Modals State
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

  useEffect(() => {
    if (projectId) {
      fetchDocuments();
      fetchFolders();
    }
  }, [projectId, fetchDocuments, fetchFolders]);

  // Socket.IO real-time synchronization
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
        setSelectedDoc(updatedDoc);
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

    socket.on("documentCreated", handleDocCreated);
    socket.on("documentUpdated", handleDocUpdated);
    socket.on("documentDeleted", handleDocDeleted);
    socket.on("documentFolderCreated", handleFolderCreated);
    socket.on("documentFolderUpdated", handleFolderUpdated);
    socket.on("documentFolderDeleted", handleFolderDeleted);

    return () => {
      socket.off("documentCreated", handleDocCreated);
      socket.off("documentUpdated", handleDocUpdated);
      socket.off("documentDeleted", handleDocDeleted);
      socket.off("documentFolderCreated", handleFolderCreated);
      socket.off("documentFolderUpdated", handleFolderUpdated);
      socket.off("documentFolderDeleted", handleFolderDeleted);
    };
  }, [projectId, selectedDoc, selectedFolderId, fetchDocuments]);

  // Autosave executor (debounced 1200ms)
  const executeSave = async (docId, newTitle, contentData) => {
    if (!docId) return;
    try {
      setSaving(true);
      setSaveStatus("saving");
      const res = await axiosClient.put(`/documents/${docId}`, {
        title: newTitle,
        content: contentData?.json || contentRef.current,
        contentHtml: contentData?.html,
      });
      setSelectedDoc(res.data);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Autosave failed:", err);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleEditorChange = (editorData) => {
    contentRef.current = editorData.json;
    setSaveStatus("unsaved");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (selectedDoc) {
      saveTimeoutRef.current = setTimeout(() => {
        executeSave(selectedDoc._id, title, editorData);
      }, 1200);
    }
  };

  const handleTitleChange = (newTitle) => {
    setTitle(newTitle);
    setSaveStatus("unsaved");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (selectedDoc) {
      saveTimeoutRef.current = setTimeout(() => {
        executeSave(selectedDoc._id, newTitle, null);
      }, 1000);
    }
  };

  const handleCreateDocument = async () => {
    try {
      const targetFolder =
        selectedFolderId !== "all" && selectedFolderId !== "root" ? selectedFolderId : null;

      const res = await axiosClient.post("/documents", {
        projectId,
        title: "Untitled Document",
        folderId: targetFolder,
        content: {
          type: "doc",
          content: [{ type: "paragraph", content: [] }],
        },
        contentHtml: "<p></p>",
      });
      const newDoc = res.data;
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDoc(newDoc);
      setTitle(newDoc.title);
      contentRef.current = newDoc.content;
      setSaveStatus("saved");
      fetchFolders();
    } catch (err) {
      alert("Failed to create document");
    }
  };

  const handleDeleteDocument = async (e, docId) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await axiosClient.delete(`/documents/${docId}`);
      const remaining = documents.filter((d) => d._id !== docId);
      setDocuments(remaining);
      if (selectedDoc?._id === docId) {
        if (remaining.length > 0) {
          setSelectedDoc(remaining[0]);
          setTitle(remaining[0].title);
          contentRef.current = remaining[0].content;
        } else {
          setSelectedDoc(null);
        }
      }
      fetchFolders();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete document");
    }
  };

  // Folder Operations
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const parent =
        selectedFolderId !== "all" && selectedFolderId !== "root" ? selectedFolderId : null;

      await axiosClient.post("/documents/folders", {
        name: newFolderName.trim(),
        color: newFolderColor,
        parentId: parent,
        projectId,
      });

      setNewFolderName("");
      setCreateFolderModalOpen(false);
      fetchFolders();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create folder");
    }
  };

  const handleDeleteFolder = async (e, folderId) => {
    e.stopPropagation();
    if (
      !confirm(
        "Delete this folder? Child folders and documents will be moved safely to the root level."
      )
    )
      return;

    try {
      await axiosClient.delete(`/documents/folders/${folderId}`);
      fetchFolders();
      fetchDocuments();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete folder");
    }
  };

  const handleMoveDocument = async () => {
    if (!selectedDoc) return;
    try {
      const targetFolder = targetMoveFolderId === "root" ? null : targetMoveFolderId;
      const res = await axiosClient.put(`/documents/${selectedDoc._id}`, {
        folderId: targetFolder,
      });
      setSelectedDoc(res.data);
      setMoveDocModalOpen(false);
      fetchDocuments();
      fetchFolders();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to move document");
    }
  };

  // Current active folder object
  const activeFolder = useMemo(() => {
    if (selectedFolderId === "all" || selectedFolderId === "root") return null;
    return folders.find((f) => f._id === selectedFolderId);
  }, [folders, selectedFolderId]);

  // Client-side search filtering across title and description excerpt
  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.title?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.folderId?.name?.toLowerCase().includes(q)
      );
    });
  }, [documents, searchQuery]);

  return (
    <div className="min-h-screen app-bg flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/kanban/${projectId}`)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
            title="Back to Kanban"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              Project Documents & Folders
            </span>
          </div>

          {/* Breadcrumb path for selected document */}
          {selectedDoc && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 pl-3 border-l border-slate-200 dark:border-slate-800">
              <span className="flex items-center gap-1">
                <Home className="w-3.5 h-3.5" /> Docs
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              {selectedDoc.folderId ? (
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {selectedDoc.folderId.name}
                </span>
              ) : (
                <span>Root</span>
              )}
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
                {selectedDoc.title}
              </span>
            </div>
          )}

          {selectedDoc && (
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-indigo-500 animate-pulse">
                  <Clock className="w-3.5 h-3.5" /> Saving...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All changes saved
                </span>
              )}
              {saveStatus === "unsaved" && (
                <span className="flex items-center gap-1 text-amber-500">
                  <Clock className="w-3.5 h-3.5" /> Unsaved changes
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertCircle className="w-3.5 h-3.5" /> Error saving
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedDoc && (
            <button
              onClick={() => {
                setTargetMoveFolderId(selectedDoc.folderId?._id || "root");
                setMoveDocModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition shadow-xs"
              title="Move document into a folder"
            >
              <MoveRight className="w-3.5 h-3.5" />
              <span>Move</span>
            </button>
          )}

          <button
            onClick={() => setCreateFolderModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition shadow-xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
            <span>New Folder</span>
          </button>

          <button
            onClick={handleCreateDocument}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Doc</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Two-Column Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Folder Tree & Document List */}
        <aside className="w-80 bg-white/70 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
          {/* Search & Sort Filters */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents and folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-slate-700 dark:text-slate-300 text-[11px] focus:outline-hidden"
                >
                  <option value="updatedAt">Last Updated</option>
                  <option value="createdAt">Date Created</option>
                  <option value="title">Title</option>
                </select>
              </div>

              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="font-semibold uppercase text-indigo-600 hover:underline"
              >
                {sortOrder}
              </button>
            </div>
          </div>

          {/* Folder Hierarchy Selector Pill Bar */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 space-y-1 overflow-x-auto">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Folders
            </div>

            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedFolderId("all")}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  selectedFolderId === "all"
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <FolderOpen className="w-3 h-3" />
                <span>All ({documents.length})</span>
              </button>

              <button
                onClick={() => setSelectedFolderId("root")}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  selectedFolderId === "root"
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Root / Unfiled</span>
              </button>

              {folders.map((folder) => {
                const isSelected = selectedFolderId === folder._id;
                return (
                  <div
                    key={folder._id}
                    className={`group inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white font-semibold shadow-xs"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span
                      onClick={() => setSelectedFolderId(folder._id)}
                      className="flex items-center gap-1 truncate max-w-[130px]"
                      title={folder.name}
                    >
                      <Folder
                        className="w-3 h-3 shrink-0"
                        style={{ color: isSelected ? "white" : folder.color || "#6366f1" }}
                      />
                      <span className="truncate">{folder.name}</span>
                      <span className="text-[10px] opacity-70">({folder.documentCount || 0})</span>
                    </span>

                    <button
                      onClick={(e) => handleDeleteFolder(e, folder._id)}
                      className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition ${
                        isSelected ? "text-indigo-200" : "text-slate-400"
                      }`}
                      title="Delete folder"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Document Items List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading && documents.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">Loading documents...</div>
            )}

            {!loading && filteredDocs.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                No documents found in this view.
              </div>
            )}

            {filteredDocs.map((doc) => {
              const isSelected = selectedDoc?._id === doc._id;
              return (
                <div
                  key={doc._id}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setTitle(doc.title);
                    contentRef.current = doc.content;
                    setSaveStatus("saved");
                  }}
                  className={`group flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition text-xs ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/60 dark:border-indigo-800/60"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <FileText
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        isSelected ? "text-indigo-600" : "text-slate-400"
                      }`}
                    />
                    <div className="truncate">
                      <div className="truncate font-semibold flex items-center gap-1.5">
                        <span className="truncate">{doc.title}</span>
                        {doc.folderId && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-medium text-white shrink-0"
                            style={{ backgroundColor: doc.folderId.color || "#6366f1" }}
                          >
                            {doc.folderId.name}
                          </span>
                        )}
                      </div>
                      {doc.description && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {doc.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteDocument(e, doc._id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition rounded"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Canvas: Document Title & TipTap Editor */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 flex justify-center">
          {selectedDoc ? (
            <div className="max-w-4xl w-full space-y-4">
              {/* Document Title Input */}
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Document Title"
                className="w-full text-2xl font-bold bg-transparent text-slate-900 dark:text-white border-b border-transparent hover:border-slate-200 dark:hover:border-slate-800 focus:border-indigo-500 focus:outline-hidden pb-1 transition"
              />

              <div className="text-[11px] text-slate-400 flex items-center gap-3">
                <span>Created by: {selectedDoc.createdBy?.name || "Author"}</span>
                <span>•</span>
                <span>
                  Folder:{" "}
                  <strong>{selectedDoc.folderId ? selectedDoc.folderId.name : "Root / Unfiled"}</strong>
                </span>
                <span>•</span>
                <span>Last updated: {new Date(selectedDoc.updatedAt).toLocaleTimeString()}</span>
              </div>

              {/* TipTap Rich Text Editor Container */}
              <TipTapEditor
                key={selectedDoc._id}
                content={selectedDoc.contentHtml || selectedDoc.content}
                onChange={handleEditorChange}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-12 text-slate-400 space-y-3">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                No Document Selected
              </h3>
              <p className="text-xs max-w-sm">
                Select an existing document from the sidebar or create a new rich-text document.
              </p>
              <button
                onClick={handleCreateDocument}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-indigo-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Document</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modal: Create Folder */}
      {createFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-500" />
                Create Document Folder
              </h3>
              <button
                onClick={() => setCreateFolderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Folder Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sprint Specifications, Architecture"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Folder Accent Color
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

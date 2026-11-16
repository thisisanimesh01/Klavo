import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";

export default function Documents() {
  const { projectId, documentId } = useParams();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved' | 'saving' | 'unsaved' | 'error'
  const [searchQuery, setSearchQuery] = useState("");

  // Editor Draft State
  const [title, setTitle] = useState("");
  const contentRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Fetch all documents for project
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get(`/documents/project/${projectId}`);
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
        // Default to first document if available
        setSelectedDoc(list[0]);
        setTitle(list[0].title);
        contentRef.current = list[0].content;
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, documentId]);

  useEffect(() => {
    if (projectId) {
      fetchDocuments();
    }
  }, [projectId, fetchDocuments]);

  // Socket.IO real-time synchronization
  useEffect(() => {
    if (!projectId) return;
    if (!socket.connected) socket.connect();

    socket.emit("joinProject", { projectId });

    const handleCreated = (newDoc) => {
      setDocuments((prev) => (prev.some((d) => d._id === newDoc._id) ? prev : [newDoc, ...prev]));
    };

    const handleUpdated = (updatedDoc) => {
      setDocuments((prev) =>
        prev.map((d) => (d._id === updatedDoc._id ? updatedDoc : d))
      );
      if (selectedDoc && selectedDoc._id === updatedDoc._id) {
        setSelectedDoc(updatedDoc);
      }
    };

    const handleDeleted = ({ documentId: delId }) => {
      setDocuments((prev) => prev.filter((d) => d._id !== delId));
      if (selectedDoc && selectedDoc._id === delId) {
        setSelectedDoc(null);
      }
    };

    socket.on("documentCreated", handleCreated);
    socket.on("documentUpdated", handleUpdated);
    socket.on("documentDeleted", handleDeleted);

    return () => {
      socket.off("documentCreated", handleCreated);
      socket.off("documentUpdated", handleUpdated);
      socket.off("documentDeleted", handleDeleted);
    };
  }, [projectId, selectedDoc]);

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
      const res = await axiosClient.post("/documents", {
        projectId,
        title: "Untitled Document",
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
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete document");
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return d.title?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q);
  });

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
              Project Documents
            </span>
          </div>

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
          <button
            onClick={handleCreateDocument}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Document</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Document List */}
        <aside className="w-72 bg-white/70 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading && documents.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">Loading documents...</div>
            )}

            {!loading && filteredDocs.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">No documents found.</div>
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
                    <FileText className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                    <div className="truncate">
                      <div className="truncate font-semibold">{doc.title}</div>
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

        {/* Right Pane: Document Title & TipTap Editor */}
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
    </div>
  );
}

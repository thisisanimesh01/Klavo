import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { FolderUp, UploadCloud, FileText, AlertCircle, CheckCircle2, Download, Trash2, HardDrive } from "lucide-react";

export default function Files() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectFiles, setProjectFiles] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Fetch available projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        const { data } = await axiosClient.get("/projects");
        setProjects(data || []);
        if (data && data.length > 0) {
          setSelectedProjectId(data[0]._id);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
        setError("Failed to load accessible projects.");
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, []);

  // Fetch files when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectFiles([]);
      return;
    }

    const fetchFiles = async () => {
      try {
        setLoadingFiles(true);
        const { data } = await axiosClient.get(`/files/project/${selectedProjectId}`);
        setProjectFiles(data || []);
      } catch (err) {
        console.error("Failed to load project files:", err);
      } finally {
        setLoadingFiles(false);
      }
    };

    fetchFiles();
  }, [selectedProjectId]);

  // Handle file upload
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    if (!selectedProjectId) {
      setError("Please select a target project.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setStatusMessage(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", selectedProjectId);

      const res = await axiosClient.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatusMessage("File uploaded successfully!");
      setFile(null);
      const inputEl = document.getElementById("file-input");
      if (inputEl) inputEl.value = "";

      // Refresh files list
      setProjectFiles((prev) => [res.data, ...prev]);
    } catch (err) {
      console.error("Upload failed:", err);
      setError(err.response?.data?.message || "File upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // Handle file download
  const handleDownload = async (fileId, filename) => {
    try {
      setError(null);
      const response = await axiosClient.get(`/files/download/${fileId}`, {
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      setError("Failed to download file. Please check file access permissions.");
    }
  };

  // Handle file deletion
  const handleDelete = async (fileId) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;

    try {
      setError(null);
      await axiosClient.delete(`/files/${fileId}`);
      setProjectFiles((prev) => prev.filter((f) => f._id !== fileId));
      setStatusMessage("File deleted successfully.");
    } catch (err) {
      console.error("Delete failed:", err);
      setError(err.response?.data?.message || "Failed to delete file.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderUp className="text-indigo-400" size={28} />
          Project File Repository
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Upload attachments, documentation, and review assets for team projects.
        </p>
      </div>

      {loadingProjects && (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {!loadingProjects && (
        <div className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-3">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {statusMessage && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center gap-3">
              <CheckCircle2 size={20} />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Project Selector & Upload Card */}
          <div
            className="p-6 rounded-2xl border space-y-6 shadow-sm"
            style={{ background: "var(--bg-card)", borderColor: "var(--card-border)" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1.5">Select Project</label>
                {projects.length === 0 ? (
                  <p className="text-sm text-amber-400">
                    No accessible projects found. Join or create a team project first.
                  </p>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{
                      background: "var(--bg-main)",
                      borderColor: "var(--card-border)",
                      color: "var(--text-main)",
                    }}
                  >
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.teamId?.name || "Team"})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => document.getElementById("file-input")?.click()}
                  className="w-full py-2.5 px-4 border border-dashed rounded-xl flex items-center justify-center gap-2 hover:border-indigo-500 transition text-sm font-medium"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <UploadCloud size={18} className="text-indigo-400" />
                  <span>{file ? file.name : "Choose File to Upload"}</span>
                </button>
                <input
                  id="file-input"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>
            </div>

            {file && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm">
                <div className="flex items-center gap-2 text-indigo-400">
                  <FileText size={16} />
                  <span>{file.name}</span>
                  <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-4 py-1.5 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition text-xs"
                >
                  {uploading ? "Uploading..." : "Confirm Upload"}
                </button>
              </div>
            )}
          </div>

          {/* Files List Card */}
          <div
            className="p-6 rounded-2xl border shadow-sm"
            style={{ background: "var(--bg-card)", borderColor: "var(--card-border)" }}
          >
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <HardDrive size={20} className="text-indigo-400" />
              Project Files ({projectFiles.length})
            </h3>

            {loadingFiles && (
              <div className="flex justify-center p-8">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {!loadingFiles && projectFiles.length === 0 && (
              <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
                No files uploaded to this project yet. Use the upload control above to add files.
              </div>
            )}

            {!loadingFiles && projectFiles.length > 0 && (
              <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                {projectFiles.map((f) => (
                  <div key={f._id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{f.filename}</p>
                        <p className="text-xs text-slate-400">
                          {f.size ? (f.size / 1024).toFixed(1) + " KB" : "Unknown size"} • Uploaded by{" "}
                          {f.userId?.name || "Team Member"} on{" "}
                          {new Date(f.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownload(f._id, f.filename)}
                        title="Download file"
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(f._id)}
                        title="Delete file"
                        className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

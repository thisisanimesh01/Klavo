import React, { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { FolderUp, UploadCloud, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

export default function Files() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const { data } = await axiosClient.get("/projects");
        setProjects(data || []);
        if (data && data.length > 0) {
          setSelectedProjectId(data[0]._id);
        }
      } catch (err) {
        console.error("Failed to load projects for files view:", err);
        setError("Failed to load accessible projects.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadMessage(null);

      const formData = new FormData();
      formData.append("file", file);
      if (selectedProjectId) {
        formData.append("projectId", selectedProjectId);
      }

      const res = await axiosClient.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadMessage(res.data.message || "File uploaded successfully!");
      setFile(null);
      // Reset input element
      const inputEl = document.getElementById("file-input");
      if (inputEl) inputEl.value = "";
    } catch (err) {
      console.error("Upload failed:", err);
      setError(err.response?.data?.message || "File upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderUp className="text-indigo-400" size={28} />
          Project File Repository
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Upload attachments and documentation to your team projects.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {!loading && (
        <div
          className="p-6 rounded-2xl border space-y-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--card-border)" }}
        >
          {error && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-3">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {uploadMessage && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center gap-3">
              <CheckCircle2 size={20} />
              <span>{uploadMessage}</span>
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">Target Project</label>
              {projects.length === 0 ? (
                <p className="text-sm text-amber-400">
                  No projects available. Create a project in Teams before uploading files.
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
              <label className="block text-sm font-medium mb-1.5">Choose File</label>
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer hover:border-indigo-500"
                style={{ borderColor: "var(--card-border)", background: "var(--bg-main)" }}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <UploadCloud className="mx-auto text-indigo-400 mb-2" size={36} />
                <p className="text-sm font-medium">Click to select a file from your device</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Documents, images, archives
                </p>
                <input
                  id="file-input"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>

              {file && (
                <div className="mt-3 flex items-center gap-2 text-sm text-indigo-400">
                  <FileText size={16} />
                  <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={uploading || !file || projects.length === 0}
              className="px-6 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

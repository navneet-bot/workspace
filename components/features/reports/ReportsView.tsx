"use client";

import { useUIStore } from "@/hooks/useUIStore";
import { useState, useRef } from "react";
import { submitReport, reviewReport, updateReport, deleteReport } from "@/app/actions/reports";
import { Paperclip, X, Pencil, Trash2 } from "lucide-react";

interface Report {
  id: number;
  title: string;
  description: string;
  fileName: string;
  fileData: string;
  submittedBy: string | null;
  reviewed: boolean;
  submittedAt: Date;
}

export function ReportsView({
  reports,
  currentUserEmail,
  canManage,
}: {
  reports: Report[];
  currentUserEmail: string;
  canManage: boolean;
}) {
  const { addToast } = useUIStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reportsList, setReportsList] = useState<Report[]>(reports);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit State
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFileName, setEditFileName] = useState("");
  const [editFileData, setEditFileData] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setFileData(result.split(",")[1]); // Store base64 payload
      addToast(`File ready: ${file.name}`, "success");
    };
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setFileName("");
    setFileData("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!title.trim()) return addToast("Task Title is required", "error");
    if (!description.trim()) return addToast("Description is required", "error");

    setLoading(true);
    const res = await submitReport({
      title,
      description,
      fileName,
      fileData,
      submittedBy: currentUserEmail,
    });
    setLoading(false);

    if (res.success && res.report) {
      addToast("Report submitted successfully!", "success");
      setReportsList((prev) => [res.report as any, ...prev]);
      setTitle("");
      setDescription("");
      clearFile();
    } else {
      addToast(res.error || "Failed to submit", "error");
    }
  };

  const handleReview = async (id: number) => {
    const res = await reviewReport(id);
    if (res.success) {
      addToast("Report marked as reviewed", "success");
      setReportsList((prev) =>
        prev.map((r) => (r.id === id ? { ...r, reviewed: true } : r))
      );
    } else {
      addToast(res.error || "Failed to review", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this report?")) return;
    const res = await deleteReport(id);
    if (res.success) {
      addToast("Report deleted successfully", "success");
      setReportsList((prev) => prev.filter((r) => r.id !== id));
    } else {
      addToast(res.error || "Failed to delete report", "error");
    }
  };

  const startEdit = (report: Report) => {
    setEditingReport(report);
    setEditTitle(report.title);
    setEditDescription(report.description);
    setEditFileName(report.fileName || "");
    setEditFileData(report.fileData || "");
  };

  const clearEditFile = () => {
    setEditFileName("");
    setEditFileData("");
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setEditFileData(result.split(",")[1]);
      addToast(`New file ready: ${file.name}`, "success");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async () => {
    if (!editingReport) return;
    if (!editTitle.trim()) return addToast("Task Title is required", "error");
    if (!editDescription.trim()) return addToast("Description is required", "error");

    setIsSavingEdit(true);
    const updateData: any = {
      title: editTitle,
      description: editDescription,
      fileName: editFileName,
      fileData: editFileData,
    };
    const res = await updateReport(editingReport.id, updateData);
    setIsSavingEdit(false);

    if (res.success && res.report) {
      addToast("Report updated successfully!", "success");
      setReportsList((prev) =>
        prev.map((r) => (r.id === editingReport.id ? { ...r, ...res.report } : r))
      );
      setEditingReport(null);
    } else {
      addToast(res.error || "Failed to update report", "error");
    }
  };

  const downloadFile = (name: string, data: string) => {
    const link = document.createElement("a");
    link.href = `data:application/octet-stream;base64,${data}`;
    link.download = name;
    link.click();
  };

  const exportReports = () => {
    if (!reportsList.length) {
      addToast("No reports to export", "info");
      return;
    }
    try {
      const csv = [
        "ID,Title,Submitted By,Description,File,Reviewed,Date",
        ...reportsList.map(
          (r) =>
            `${r.id},"${r.title}","${r.submittedBy || ""}","${(
              r.description || ""
            ).replace(/"/g, "'")}","${r.fileName || ""}",${r.reviewed},${r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-IN") : ""
            }`
        ),
      ].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "reports.csv";
      a.click();
      addToast("Reports exported!", "success");
    } catch (e) {
      addToast("Export failed", "error");
    }
  };

  return (
    <div className="page-stack">
      <div className="report-form">
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "18px" }}>
          Submit Report
        </h3>
        <div className="field">
          <label>Task Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What task are you reporting on?"
          />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you worked on..."
            rows={3}
          />
        </div>

        <div className="field">
          <label>
            Attach File <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(any type — PDF, image, doc, zip…)</span>
          </label>
          <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--surface2)", border: "1.5px dashed var(--border)", borderRadius: "10px", padding: "12px 18px", transition: "border-color .2s" }}>
            <span style={{ fontSize: "20px" }}>📎</span>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {fileName ? "File selected" : "Click to choose file or drop here"}
            </span>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} />
          </label>
          {fileName && (
            <div style={{ marginTop: "8px", padding: "8px 12px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", fontSize: "12.5px", color: "var(--green)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>✅</span><span>{fileName}</span>
              <button onClick={clearFile} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "14px" }}>✕</button>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-sm btn-accent disabled:opacity-70"
        >
          {loading ? "Submitting..." : "Submit Report"}
        </button>
      </div>
      <div style={{ height: 20 }} />

      <div className="table-card">
        <div className="table-card-header">
          <h3>
            {canManage ? "All Reports" : "My Reports"}
          </h3>
          <button
            onClick={exportReports}
            className="btn-sm btn-outline"
          >
            ↓ Export CSV
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Submitted By</th>
                <th>Task</th>
                <th>Date</th>
                <th>Description</th>
                <th>File</th>
                {canManage && <th>Status</th>}
                <th style={{ minWidth: "100px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reportsList.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                    No reports yet
                  </td>
                </tr>
              ) : (
                reportsList.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.submittedBy || "Unknown"}</strong>
                      <br />
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{r.submittedBy || ""}</span>
                    </td>
                    <td>{r.title}</td>
                    <td>
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td style={{ maxWidth: "180px", fontSize: "12.5px", color: "var(--text-muted)" }}>
                      {r.description || "—"}
                    </td>
                    <td>
                      {r.fileName && r.fileData ? (
                        <button
                          onClick={() => downloadFile(r.fileName, r.fileData)}
                          className="action-btn action-view"
                        >
                          📥 {r.fileName}
                        </button>
                      ) : r.fileName ? (
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>📄 {r.fileName}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    {canManage && (
                      <td>
                        {r.reviewed ? (
                          <span className="badge badge-green">
                            Reviewed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleReview(r.id)}
                            className="action-btn action-approve"
                          >
                            ✓ Review
                          </button>
                        )}
                      </td>
                    )}
                    <td>
                      {(canManage || r.submittedBy === currentUserEmail) ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => startEdit(r)}
                            className="action-btn action-edit flex items-center justify-center"
                            style={{ width: "28px", height: "28px", padding: 0, borderRadius: "6px" }}
                            title="Edit Report"
                          >
                            <Pencil size={12} className="stroke-[2.5]" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="action-btn action-reject flex items-center justify-center"
                            style={{ width: "28px", height: "28px", padding: 0, borderRadius: "6px" }}
                            title="Delete Report"
                          >
                            <Trash2 size={12} className="stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingReport && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(3px)",
        }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            width: "90vw",
            maxWidth: "500px",
            boxShadow: "0 24px 64px rgba(0,0,0,.5)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Edit Report</h3>
              <button 
                onClick={() => setEditingReport(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="field">
              <label>Task Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="What task are you reporting on?"
              />
            </div>

            <div className="field">
              <label>Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe what you worked on..."
                rows={4}
              />
            </div>

            <div className="field">
              <label>
                Attach File <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
              </label>
              <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--surface2)", border: "1.5px dashed var(--border)", borderRadius: "10px", padding: "12px 18px", transition: "border-color .2s" }}>
                <span style={{ fontSize: "20px" }}>📎</span>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {editFileName ? "Replace file" : "Click to choose file or drop here"}
                </span>
                <input type="file" onChange={handleEditFileChange} style={{ display: "none" }} />
              </label>
              {editFileName && (
                <div style={{ marginTop: "8px", padding: "8px 12px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", fontSize: "12.5px", color: "var(--green)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>✅</span><span style={{ wordBreak: "break-all" }}>{editFileName}</span>
                  <button onClick={clearEditFile} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "14px" }}>✕</button>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditingReport(null)}
                className="btn-sm btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="btn-sm btn-accent"
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

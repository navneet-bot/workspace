"use client";

import { useState } from "react";
import { useUIStore } from "@/hooks/useUIStore";
import { createMeeting, deleteMeeting } from "@/app/actions/meetings";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar as CalendarIcon, Clock, Trash2, X } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Meeting {
  id: number;
  title: string;
  description: string;
  date: string | null;
  time: string | null;
  meetLink: string;
  members: string; // JSON
  createdBy: string | null;
}

export function MeetingsList({
  initialMeetings,
  allUsers,
  canManage,
  currentUserEmail,
}: {
  initialMeetings: Meeting[];
  allUsers: User[];
  canManage: boolean;
  currentUserEmail: string;
}) {
  const { addToast } = useUIStore();
  const [meetings, setMeetings] = useState(initialMeetings);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const teamMembers = allUsers.filter((u) => u.role !== "admin");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return addToast("Title is required", "error");
    if (!date || !time) return addToast("Date and time are required", "error");

    setLoading(true);
    const res = await createMeeting({
      title,
      description,
      date,
      time,
      meetLink,
      members: JSON.stringify(selectedMembers),
      createdBy: currentUserEmail,
    });
    setLoading(false);

    if (res.success && res.meeting) {
      addToast("Meeting scheduled successfully!", "success");
      setMeetings((prev) => [res.meeting as any, ...prev]);
      setIsModalOpen(false);
      setTitle("");
      setDescription("");
      setDate("");
      setTime("");
      setMeetLink("");
      setSelectedMembers([]);
    } else {
      addToast(res.error || "Failed to schedule meeting", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this meeting?")) return;
    const res = await deleteMeeting(id);
    if (res.success) {
      addToast("Meeting deleted", "success");
      setMeetings(meetings.filter((m) => m.id !== id));
    } else {
      addToast(res.error || "Failed to delete", "error");
    }
  };

  const toggleMember = (email: string) => {
    setSelectedMembers((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  return (
    <div className="page-stack">
      {canManage && (
        <div className="toolbar-row">
          <div />
          <button
            onClick={() => {
              setIsModalOpen(true);
              setDate(new Date().toISOString().split("T")[0]);
            }}
            className="btn-sm btn-accent"
          >
            + Schedule Meeting
          </button>
        </div>
      )}

      <div className="meetings-list">
        {meetings.map((m) => {
          const d = new Date((m.date || "") + "T00:00:00" || Date.now());
          let membersList: string[] = [];
          try {
            membersList = JSON.parse(m.members || "[]");
          } catch (e) {}

          const memberNames = membersList.map((email) => {
            const u = allUsers.find((x) => x.email === email);
            return u ? u.name.split(" ")[0] : email.split("@")[0];
          });

          return (
            <div key={m.id} className="meet-card">
              <div className="meet-time">
                <div className="mdate">{isNaN(d.getDate()) ? "?" : d.getDate()}</div>
                <div className="mmon">
                  {isNaN(d.getTime())
                    ? "TBD"
                    : d.toLocaleString("en-IN", { month: "short" })}
                </div>
              </div>
              <div className="meet-divider"></div>
              <div className="meet-info">
                <h4>{m.title}</h4>
                <p>
                  🕐 {m.time || "TBD"} · by{" "}
                  {m.createdBy ? m.createdBy.split("@")[0] : "admin"}
                </p>
                {m.description && (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    {m.description}
                  </p>
                )}
                {memberNames.length > 0 && (
                  <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>👥</span>
                    {memberNames.map((n, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "11px",
                          padding: "2px 7px",
                          background: "var(--surface2)",
                          border: "1px solid var(--border)",
                          borderRadius: "20px",
                        }}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                {m.meetLink && (
                  <a
                    className="meet-link font-syne text-[12.5px]"
                    href={m.meetLink.startsWith("http") ? m.meetLink : `https://${m.meetLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🎥 Join
                  </a>
                )}
                {canManage && (
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="action-btn action-reject flex items-center justify-center"
                    style={{ padding: "4px 8px" }}
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {meetings.length === 0 && (
          <div className="empty-state" style={{ padding: "40px", fontSize: "12.5px" }}>
            No meetings scheduled
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-shell">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="modal meeting-modal w-full !max-w-[520px]"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <h3 style={{ margin: 0 }}>📅 Schedule Meeting</h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="modal-close"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="modal-form">
                <div className="form-body">
                  <div className="field">
                    <label>Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Sprint Planning"
                    />
                  </div>

                  <div className="field">
                    <label>Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What is this meeting about?"
                      rows={2}
                      style={{ resize: "vertical" }}
                    />
                  </div>

                  <div className="form-row">
                    <div className="field">
                      <label>Date</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Time</label>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Google Meet Link</label>
                    <input
                      type="text"
                      value={meetLink}
                      onChange={(e) => setMeetLink(e.target.value)}
                      placeholder="https://meet.google.com/..."
                    />
                  </div>

                  <div className="field">
                    <label style={{ textTransform: "none", letterSpacing: "normal", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
                      Invite Members <span className="font-normal text-jj-text-muted">(notifications sent automatically)</span>
                    </label>
                    <div className="mb-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMembers(teamMembers.map((u) => u.email))}
                        className="action-btn action-approve"
                        style={{ fontSize: "11px" }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMembers([])}
                        className="action-btn action-reject"
                        style={{ fontSize: "11px" }}
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="members-container">
                      {teamMembers.map((u) => (
                        <div
                          key={u.email}
                          className="member-row"
                          onClick={() => toggleMember(u.email)}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="member-info">
                            <span className="member-name">{u.name}</span>
                            <span className="member-role">{u.role}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(u.email)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleMember(u.email);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="member-checkbox"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-sm btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-sm btn-accent disabled:opacity-70"
                  >
                    {loading ? "Scheduling..." : "📅 Schedule & Notify"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

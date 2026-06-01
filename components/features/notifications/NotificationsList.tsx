"use client";

import { useState } from "react";
import { useUIStore } from "@/hooks/useUIStore";
import { sendNotification, markRead, markAllRead, clearAllNotifications, deleteNotification } from "@/app/actions/notifications";
import { Check, Trash2, Bell, Eye } from "lucide-react";
import { useRouter } from "next/navigation";

interface Notification {
  id: number;
  title: string;
  body: string;
  icon: string;
  targetEmail: string;
  read: boolean;
  seenBy: string; // JSON array of emails
  createdAt: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export function NotificationsList({
  initialNotifications,
  allUsers,
  currentUserEmail,
  canSend,
}: {
  initialNotifications: Notification[];
  allUsers: User[];
  currentUserEmail: string;
  canSend: boolean;
}) {
  const { addToast } = useUIStore();
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);

  // Form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [icon, setIcon] = useState("🔔");
  const [target, setTarget] = useState("ALL");
  const [loading, setLoading] = useState(false);

  const interns = allUsers.filter((u) => u.role !== "admin");

  const handleSend = async () => {
    if (!title.trim()) return addToast("Title is required", "error");
    if (!body.trim()) return addToast("Message is required", "error");
    
    setLoading(true);
    const res = await sendNotification({ title, body, icon, targetEmail: target });
    setLoading(false);

    if (res.success) {
      addToast("Notification sent successfully!", "success");
      setTitle("");
      setBody("");
      setIcon("🔔");
      setTarget("ALL");
      window.location.reload();
    } else {
      addToast(res.error || "Failed to send", "error");
    }
  };

  const handleMarkRead = async (id: number) => {
    const res = await markRead(id, currentUserEmail);
    if (res.success) {
      setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const handleMarkAllRead = async () => {
    const res = await markAllRead(currentUserEmail, currentUserEmail);
    if (res.success) {
      addToast("All marked as read", "success");
      setNotifications(notifications.map((n) => ({ ...n, read: true })));
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all notifications?")) return;
    const res = await clearAllNotifications(currentUserEmail);
    if (res.success) {
      addToast("Notifications cleared", "success");
      setNotifications([]);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await deleteNotification(id);
    if (res.success) {
      setNotifications(notifications.filter((n) => n.id !== id));
      addToast("Deleted", "success");
    }
  };

  const getSeenNames = (seenByStr: string) => {
    let seenList: string[] = [];
    try {
      seenList = JSON.parse(seenByStr || "[]");
    } catch {}
    return seenList.map((email) => {
      const u = allUsers.find((x) => x.email === email);
      return u ? u.name.split(" ")[0] : email.split("@")[0];
    });
  };

  return (
    <div className="page-stack">
      {canSend && (
        <div className="surface-panel mb-4">
          <div className="surface-header !py-4 !px-5 border-b border-jj-border">
            <h3 className="surface-title m-0">📣 Send Notification</h3>
          </div>
          <div className="surface-body flex flex-wrap items-end gap-2.5 !p-4">
            <div className="field !mb-0 flex-1 min-w-[160px]">
              <label>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
              />
            </div>
            <div className="field !mb-0 flex-[2] min-w-[200px]">
              <label>Message</label>
              <input
                type="text"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message here..."
              />
            </div>
            <div className="field !mb-0 w-[70px]">
              <label>Icon</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🔔"
                className="text-center"
              />
            </div>
            <div className="field !mb-0 min-w-[180px]">
              <label>Send To</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="ALL">📢 Everyone</option>
                {interns.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSend}
              disabled={loading}
              className="btn-sm btn-accent h-9 flex items-center gap-1.5"
            >
              🔔 Send
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <span style={{ fontSize: "13.5px", color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text)", fontSize: "15px" }}>{notifications.filter((n) => !n.read).length}</strong> unread · {notifications.length} total
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleMarkAllRead}
            className="btn-sm btn-outline flex items-center gap-1.5"
          >
            <Check size={14} /> Mark all read
          </button>
          <button
            onClick={handleClearAll}
            className="btn-sm btn-outline flex items-center gap-1.5"
            style={{ color: "var(--red)", borderColor: "rgba(239,68,68,0.3)" }}
          >
            <Trash2 size={14} /> Clear All
          </button>
        </div>
      </div>

      <div className="notif-list">
        {notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            No notifications yet
          </div>
        ) : (
          notifications.map((n) => {
            const seenNames = getSeenNames(n.seenBy);
            return (
              <div
                key={n.id}
                className={`notif-item ${n.read ? "" : "unread"}`}
              >
                <div className="notif-icon" style={{ background: "rgba(245,158,11,0.12)" }}>
                  {n.icon || "🔔"}
                </div>
                
                <div className="notif-body flex-1">
                  <h5>{n.title}</h5>
                  {n.body && <p>{n.body}</p>}
                  
                  <div className="notif-time">
                    {new Date(n.createdAt).toLocaleString("en-IN")}
                  </div>

                  {canSend && (
                    <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                      {seenNames.length > 0 ? (
                        <>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>👁 Seen by ({seenNames.length}):</span>
                          {seenNames.map((name, i) => (
                            <span key={i} style={{ fontSize: "11px", padding: "2px 7px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "20px", color: "var(--green)" }}>
                              {name}
                            </span>
                          ))}
                        </>
                      ) : (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>👁 Not seen by anyone yet</div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  {!n.read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="action-btn action-approve"
                    >
                      ✓ Read
                    </button>
                  )}
                  {canSend && (
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="action-btn action-reject flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

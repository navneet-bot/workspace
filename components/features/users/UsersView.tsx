"use client";

import { useState } from "react";
import { useUIStore } from "@/hooks/useUIStore";
import { promoteUser, demoteUser, deleteUser, updateUserPermissions, updateUserRole, createUser } from "@/app/actions/users";
import { Trash2 } from "lucide-react";

import { AnimatePresence, motion } from "framer-motion";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: string;
  jobjockeyId?: string | null;
}

const ALL_PERMISSIONS = [
  { key: "create_task", label: "Create Tasks", desc: "Can create and assign tasks to interns", icon: "📋" },
  { key: "delete_task", label: "Delete Tasks", desc: "Can remove any task from the system", icon: "🗑" },
  { key: "manage_attendance", label: "Manage Attendance", desc: "Can mark attendance for all members", icon: "📅" },
  { key: "view_reports", label: "View & Review Reports", desc: "Can see and review all intern reports", icon: "📄" },
  { key: "manage_groups", label: "Manage Groups", desc: "Can create and manage groups", icon: "👥" },
  { key: "manage_meetings", label: "Schedule Meetings", desc: "Can schedule and manage meetings", icon: "📅" },
  { key: "manage_candidates", label: "View Candidates", desc: "Can view and manage candidates", icon: "🎯" },
  { key: "view_tutors", label: "View Tutors", desc: "Can view the list of tutor applications", icon: "👨‍🏫" },
  { key: "create_tutors", label: "Create Tutors", desc: "Can manually add tutor records", icon: "➕" },
  { key: "edit_tutors", label: "Edit Tutors", desc: "Can modify tutor credentials and profiles", icon: "📝" },
  { key: "delete_tutors", label: "Delete Tutors", desc: "Can delete tutor records from the system", icon: "🗑️" },
  { key: "import_tutors", label: "Import Tutors", desc: "Can bulk import tutors via CSV or Google Sheets", icon: "📥" },
  { key: "manage_tutor_interviews", label: "Manage Tutor Interviews", desc: "Can schedule interviews and update tutor status", icon: "💬" },
  { key: "send_notifications", label: "Send Notifications", desc: "Can send notifications to team", icon: "🔔" },
  { key: "view_productivity", label: "View Productivity", desc: "Can view productivity reports", icon: "📊" },
  { key: "manage_projects", label: "Manage Projects", desc: "Can create and update projects", icon: "🚀" },
  { key: "request_break", label: "Request Break", desc: "Can request short breaks during working hours", icon: "☕" },
  { key: "approve_break", label: "Approve Break", desc: "Can approve intern break requests", icon: "✅" },
  { key: "reject_break", label: "Reject Break", desc: "Can reject intern break requests", icon: "❌" },
  { key: "view_break_requests", label: "View Break Requests", desc: "Can view the list and logs of break requests", icon: "📋" },
  { key: "manage_break_requests", label: "Manage Break Requests", desc: "Full control over break request configuration and actions", icon: "⚙️" },
];

export function UsersView({ initialUsers }: { initialUsers: User[] }) {
  const { addToast } = useUIStore();
  const [users, setUsers] = useState(initialUsers);
  
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [permMode, setPermMode] = useState<"default" | "promote">("default");
  const [loading, setLoading] = useState(false);

  // User creation states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("intern");
  const [newPassword, setNewPassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ name: string; email: string; jobjockeyId: string; role: string } | null>(null);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return addToast("Name is required", "error");
    if (!newEmail.trim()) return addToast("Email is required", "error");

    setCreateLoading(true);
    const res = await createUser({
      name: newName,
      email: newEmail,
      role: newRole,
      password: newPassword || undefined,
    });
    setCreateLoading(false);

    if (res.success && res.user) {
      addToast("User created successfully!", "success");
      setUsers([...users, {
        id: res.user.id,
        name: res.user.name,
        email: res.user.email,
        role: res.user.role,
        permissions: "",
        jobjockeyId: res.user.jobjockeyId
      }]);
      setCreatedUser({
        name: res.user.name,
        email: res.user.email,
        jobjockeyId: res.user.jobjockeyId || "",
        role: res.user.role
      });
      // Clear inputs
      setNewName("");
      setNewEmail("");
      setNewRole("intern");
      setNewPassword("");
    } else {
      addToast(res.error || "Failed to create user", "error");
    }
  };

  const handlePromote = async (u: User) => {
    setSelectedUser(u);
    setSelectedPerms(u.permissions ? u.permissions.split(",").map((p) => p.trim()) : []);
    setPermMode("default");
    setIsPermModalOpen(true);
  };

  const handleUpdateRole = async (id: number, role: string, name: string) => {
    const roleLabel = role === "super_admin" ? "Super Admin" : role === "tutor" ? "Tutor" : "Intern";
    if (!confirm(`Are you sure you want to change ${name}'s role to ${roleLabel}?`)) return;
    const res = await updateUserRole(id, role);
    if (res.success) {
      addToast(`${name}'s role updated to ${roleLabel}`, "success");
      setUsers(users.map((u) => (u.id === id ? { ...u, role } : u)));
    } else {
      addToast(res.error || "Failed to update role", "error");
    }
  };

  const handleDemote = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to demote ${name} to Intern?`)) return;
    const res = await demoteUser(id);
    if (res.success) {
      addToast(`${name} demoted to Intern`, "success");
      setUsers(users.map((u) => (u.id === id ? { ...u, role: "intern", permissions: "" } : u)));
    } else {
      addToast(res.error || "Failed to demote", "error");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete user ${name}?`)) return;
    const res = await deleteUser(id);
    if (res.success) {
      addToast("User deleted", "success");
      setUsers(users.filter((u) => u.id !== id));
    } else {
      addToast(res.error || "Failed to delete", "error");
    }
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setLoading(true);

    const permString = selectedPerms.join(",");
    let success = false;

    if (permMode === "promote") {
      // First promote, then update permissions
      const res1 = await promoteUser(selectedUser.id);
      if (res1.success) {
        const res2 = await updateUserPermissions(selectedUser.id, permString);
        if (res2.success) success = true;
      }
    } else {
      const res = await updateUserPermissions(selectedUser.id, permString);
      if (res.success) success = true;
    }

    setLoading(false);

    if (success) {
      addToast("Permissions updated successfully", "success");
      setIsPermModalOpen(false);
      // Optimistic
      setUsers(
        users.map((u) =>
          u.id === selectedUser.id
            ? { ...u, role: permMode === "promote" ? "super_admin" : u.role, permissions: permString }
            : u
        )
      );
    } else {
      addToast("Failed to update permissions", "error");
    }
  };

  const togglePerm = (key: string) => {
    setSelectedPerms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSelectAll = (select: boolean) => {
    setSelectedPerms(select ? ALL_PERMISSIONS.map((p) => p.key) : []);
  };

  const RoleBadge = ({ role }: { role: string }) => {
    if (role === "admin")
      return <span className="badge badge-red">admin</span>;
    if (role === "super_admin")
      return <span className="badge badge-purple">super admin</span>;
    if (role === "tutor")
      return <span className="badge badge-green">tutor</span>;
    return <span className="badge badge-blue">intern</span>;
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="table-card">
        <div className="table-card-header">
          <h3>All Users & Roles</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{users.length} total</span>
            <button
              onClick={() => {
                setCreatedUser(null);
                setIsCreateModalOpen(true);
              }}
              className="btn-sm btn-accent"
            >
              + New User
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>JobJockey ID</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{u.email}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {u.jobjockeyId || <span style={{ fontStyle: "italic", opacity: 0.6 }}>Legacy Account</span>}
                  </td>
                  <td>
                    <RoleBadge role={u.role} />
                  </td>
                  <td style={{ fontSize: 11.5, color: "var(--text-muted)", maxWidth: 200 }}>
                    {u.permissions ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {u.permissions.split(",").map((p) => (
                          <span
                            key={p}
                            style={{
                              padding: "1px 6px",
                              background: "rgba(139,92,246,0.12)",
                              border: "1px solid rgba(139,92,246,0.25)",
                              borderRadius: 10,
                              fontSize: 10.5,
                              color: "var(--purple)",
                            }}
                          >
                            {p.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {u.role !== "admin" ? (
                      <>
                        <button
                          onClick={() => handlePromote(u)}
                          className="action-btn action-edit"
                        >
                          🔧 Permissions
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          className="action-btn action-reject flex items-center justify-center"
                          style={{ width: "28px", height: "28px", padding: 0, borderRadius: "6px" }}
                        >
                          <Trash2 size={12} className="stroke-[2.5]" />
                        </button>
                      </>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Boss</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card" style={{ marginTop: 16 }}>
        <div className="table-card-header">
          <h3>Role Hierarchy & Permissions</h3>
        </div>
        <div style={{ padding: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: 18, flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>👑</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--red)" }}>Admin — Boss</div>
            <ul style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, paddingLeft: 16, lineHeight: 2.2 }}>
              <li>Full platform control</li>
              <li>Promote → Super Admin</li>
              <li>Set custom permissions</li>
              <li>Demote / Delete users</li>
              <li>All modules</li>
            </ul>
          </div>
          <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 12, padding: 18, flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⭐</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--purple)" }}>Super Admin</div>
            <ul style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, paddingLeft: 16, lineHeight: 2.2 }}>
              <li>Permissions set by Admin</li>
              <li>Click 🔧 to customize</li>
              <li>Can vary per user</li>
            </ul>
          </div>
          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 12, padding: 18, flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>👨‍🏫</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--green)" }}>Tutor</div>
            <ul style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, paddingLeft: 16, lineHeight: 2.2 }}>
              <li>Onboarded via recruitment</li>
              <li>Access student dashboard</li>
              <li>Manage students & assignments</li>
              <li>Chat with team</li>
            </ul>
          </div>
          <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 12, padding: 18, flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🎓</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--blue)" }}>Intern</div>
            <ul style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, paddingLeft: 16, lineHeight: 2.2 }}>
              <li>View own tasks</li>
              <li>Mark own attendance</li>
              <li>Submit reports</li>
              <li>Chat with team</li>
            </ul>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isPermModalOpen && selectedUser && (
          <div className="modal-shell">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="modal permissions-modal shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
            >
              {/* Header */}
              <div className="permissions-modal-header">
                <div>
                  <h2>{permMode === "promote" ? "Promote to Super Admin" : "Set Permissions"}</h2>
                  <p>Configure permissions for {selectedUser.name}</p>
                </div>
                <button
                  onClick={() => setIsPermModalOpen(false)}
                  className="modal-close text-[20px]"
                >
                  ✕
                </button>
              </div>

              {/* Quick select */}
              <div className="permissions-quick-select">
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="action-btn action-approve" onClick={() => handleSelectAll(true)}>Select All</button>
                  <button className="action-btn action-reject" onClick={() => handleSelectAll(false)}>Clear All</button>
                </div>
                <span
                  style={{ marginLeft: "auto", fontWeight: 600 }}
                  className={`text-[13px] ${selectedPerms.length > 0 ? "text-jj-accent" : "text-jj-text-muted"}`}
                >
                  {selectedPerms.length} Selected
                </span>
              </div>

              {/* Permissions list */}
              <div className="permissions-grid">
                {ALL_PERMISSIONS.map((p) => {
                  const isChecked = selectedPerms.includes(p.key);
                  return (
                    <label
                      key={p.key}
                      className={`permission-item ${isChecked ? "selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePerm(p.key)}
                        className="permission-item-checkbox"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="permission-item-title">
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </div>
                        <div className="permission-item-desc">
                          {p.desc}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="permissions-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsPermModalOpen(false)}
                  className="btn-large btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={savePermissions}
                  disabled={loading}
                  className="btn-large btn-accent"
                >
                  {loading ? "Saving..." : "✓ Save Permissions"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW USER CREATION MODAL */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="modal-shell">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="modal modal-scrollable shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
              style={{ maxWidth: "450px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <h3 style={{ margin: 0 }}>{createdUser ? "User Account Details" : "Create New User"}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setCreatedUser(null);
                  }}
                  className="modal-close"
                >
                  ✕
                </button>
              </div>

              {createdUser ? (
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div style={{ fontSize: "40px", marginBottom: "16px" }}>🎉</div>
                  <h3 style={{ color: "var(--green)", marginBottom: "8px", fontSize: "16px", fontWeight: 700 }}>
                    Account Created Successfully!
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px" }}>
                    A welcome email containing credentials has been dispatched.
                  </p>
                  
                  <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "10px", padding: "18px", textAlign: "left", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-soft)", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Name</span>
                      <strong style={{ fontSize: "14px", color: "var(--text)" }}>{createdUser.name}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-soft)", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Personal Email</span>
                      <span style={{ fontSize: "13px", color: "var(--text)" }}>{createdUser.email}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-soft)", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Generated JobJockey ID</span>
                      <strong style={{ fontSize: "14px", color: "var(--accent)" }}>{createdUser.jobjockeyId}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-soft)", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Login ID</span>
                      <strong style={{ fontSize: "14px", color: "var(--accent)" }}>{createdUser.jobjockeyId}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-soft)", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Role</span>
                      <span className="badge badge-blue" style={{ marginTop: "4px" }}>{createdUser.role}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setCreatedUser(null);
                    }}
                    className="btn-sm btn-accent w-full"
                    style={{ minHeight: "40px", fontSize: "13px" }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateSubmit} className="modal-form">
                  <div className="form-body">
                    <div className="field">
                      <label>Full Name</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Maniarasan J"
                        required
                      />
                    </div>

                    <div className="field">
                      <label>Personal Email</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="e.g. maniarasan@gmail.com"
                        required
                      />
                    </div>

                    <div className="field">
                      <label>Role</label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                      >
                        <option value="intern">Intern</option>
                        <option value="tutor">Tutor</option>
                        <option value="super_admin">Super Admin / Employee</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>Password (Optional)</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave blank to auto-generate"
                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="btn-sm btn-outline"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="btn-sm btn-accent"
                    >
                      {createLoading ? "Creating..." : "Create User"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useUIStore } from "@/hooks/useUIStore";
import { updateTaskStatus, updateTask, deleteTask } from "@/app/actions/tasks";
import { getUsersForSelect, getProjectsForSelect } from "@/app/actions/metadata";
import { useState, useEffect } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  assignedTo: string | null;
  project: string;
}

export function TasksTable({ initialTasks }: { initialTasks: Task[] }) {
  const { setTaskModalOpen, addToast } = useUIStore();
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");

  // Sync initialTasks when refreshed
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Users and projects lists
  const [usersList, setUsersList] = useState<{ email: string; name: string }[]>([]);
  const [projectsList, setProjectsList] = useState<{ id: number; name: string }[]>([]);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editPriority, setEditPriority] = useState("Medium");
  const [editDeadline, setEditDeadline] = useState("");
  const [editProject, setEditProject] = useState("");
  const [editStatus, setEditStatus] = useState("Pending");
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (isEditModalOpen) {
      getUsersForSelect().then((u) => setUsersList(u.map(x => ({ email: x.email, name: x.name }))));
      getProjectsForSelect().then(setProjectsList);
    }
  }, [isEditModalOpen]);

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    const original = [...tasks];
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    const res = await updateTaskStatus(taskId, newStatus);
    if (!res.success) {
      setTasks(original);
      addToast(res.error || "Failed", "error");
    } else {
      addToast("Status updated", "success");
    }
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditAssignedTo(task.assignedTo || "");
    setEditPriority(task.priority);
    setEditDeadline(task.deadline && task.deadline !== "TBD" ? task.deadline : "");
    setEditProject(task.project || "");
    setEditStatus(task.status);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    if (!editTitle.trim()) return addToast("Task Title is required", "error");

    setEditLoading(true);
    const res = await updateTask(editingTask.id, {
      title: editTitle,
      description: editDescription,
      assignedTo: editAssignedTo || null,
      priority: editPriority,
      deadline: editDeadline || "TBD",
      project: editProject,
      status: editStatus,
    });
    setEditLoading(false);

    if (res.success) {
      addToast("Task updated successfully!", "success");
      setTasks(tasks.map((t) => (t.id === editingTask.id ? {
        ...t,
        title: editTitle,
        description: editDescription,
        assignedTo: editAssignedTo || null,
        priority: editPriority,
        deadline: editDeadline || "TBD",
        project: editProject,
        status: editStatus,
      } : t)));
      setIsEditModalOpen(false);
      setEditingTask(null);
    } else {
      addToast(res.error || "Failed to update task", "error");
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    
    const res = await deleteTask(taskId);
    if (res.success) {
      addToast("Task deleted successfully", "success");
      setTasks(tasks.filter((t) => t.id !== taskId));
    } else {
      addToast(res.error || "Failed to delete task", "error");
    }
  };

  const prioritySpan = (priority: string) => {
    let color = "";
    if (priority === "High") color = "priority-high";
    else if (priority === "Low") color = "priority-low";
    else color = "priority-medium";
    return (
      <span className={color}>
        {priority}
      </span>
    );
  };

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.assignedTo || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="table-tools">
        <input
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <button
          onClick={() => setTaskModalOpen(true)}
          className="btn-sm btn-accent"
        >
          + New Task
        </button>
      </div>
      
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Assignee</th>
              <th>Project</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                  No tasks found.
                </td>
              </tr>
            ) : (
              filteredTasks.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-soft)" }}>#{t.id}</td>
                  <td>
                    <strong>{t.title}</strong>
                    {t.description && (
                      <>
                        <br />
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                          {t.description}
                        </span>
                      </>
                    )}
                  </td>
                  <td>{t.assignedTo || <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td>{t.project || <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td>{prioritySpan(t.priority)}</td>
                  <td>
                    <select
                      value={t.status}
                      onChange={(e) => handleStatusChange(t.id, e.target.value)}
                      style={{
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        color: "var(--text)",
                        fontSize: "12px",
                        outline: "none",
                        cursor: "pointer"
                      }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </td>
                  <td style={{ color: "var(--text-soft)" }}>{t.deadline || "TBD"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button 
                        onClick={() => handleOpenEdit(t)}
                        className="action-btn action-edit flex items-center gap-1"
                        style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "12px" }}
                      >
                        <Pencil size={12} className="stroke-[2.5]" />
                        <span>Edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="action-btn action-reject flex items-center justify-center"
                        style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px" }}
                      >
                        <Trash2 size={12} className="stroke-[2.5]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* EDIT TASK MODAL */}
      <AnimatePresence>
        {isEditModalOpen && editingTask && (
          <div className="modal-shell">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="modal modal-scrollable"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <h3 style={{ margin: 0 }}>Edit Task</h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingTask(null);
                  }}
                  className="modal-close"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="modal-form">
                <div className="form-body">
                  <div className="field">
                    <label>Task Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="e.g. Build Login Page"
                    />
                  </div>

                  <div className="form-row">
                    <div className="field">
                      <label>Assign To</label>
                      <select
                        value={editAssignedTo}
                        onChange={(e) => setEditAssignedTo(e.target.value)}
                      >
                        <option value="">-- Unassigned --</option>
                        {usersList.map((u) => (
                          <option key={u.email} value={u.email}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Priority</label>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="field">
                      <label>Deadline</label>
                      <input
                        type="date"
                        value={editDeadline}
                        onChange={(e) => setEditDeadline(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Project</label>
                      <select
                        value={editProject}
                        onChange={(e) => setEditProject(e.target.value)}
                      >
                        <option value="">-- Select Project --</option>
                        {projectsList.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label>Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Task details..."
                      rows={2}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingTask(null);
                    }}
                    className="btn-sm btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="btn-sm btn-accent disabled:opacity-70"
                  >
                    {editLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}


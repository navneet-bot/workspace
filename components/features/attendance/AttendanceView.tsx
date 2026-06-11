"use client";

import { useUIStore } from "@/hooks/useUIStore";
import { useState, useEffect } from "react";
import { markAttendance, getPendingLeaves, batchApproveLeave, batchRejectLeave } from "@/app/actions/attendance";
import { submitBreakRequest, getActiveBreak, getBreakRequests, approveBreakRequest, rejectBreakRequest } from "@/app/actions/breaks";
import { Clock, Coffee, Heart, Calendar, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AttendanceRecord {
  id: number;
  email: string | null;
  date: string | null;
  status: string;
}

interface User {
  id?: number;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
}

export function AttendanceView({
  role,
  permissions = "",
  currentUserEmail,
  users,
  attendance,
}: {
  role: string;
  permissions?: string;
  currentUserEmail: string;
  users: User[];
  attendance: AttendanceRecord[];
}) {
  const { addToast } = useUIStore();
  const [records, setRecords] = useState<AttendanceRecord[]>(attendance);
  const [internAttDate, setInternAttDate] = useState<Date>(new Date());
  const [leaveDate, setLeaveDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [leaveEndDate, setLeaveEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [leaveType, setLeaveType] = useState<string>("Sick Leave");
  const [leaveReason, setLeaveReason] = useState<string>("");
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Break Request States
  const [activeBreak, setActiveBreak] = useState<any | null>(null);
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [duration, setDuration] = useState("30");
  const [customDuration, setCustomDuration] = useState("");
  const [reason, setReason] = useState("Tea Break");
  const [customReason, setCustomReason] = useState("");
  const [breakLoading, setBreakLoading] = useState(false);

  // Admin View States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [adminCalDate, setAdminCalDate] = useState<Date>(new Date());
  const [selectedDateRecords, setSelectedDateRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<"daily" | "breaks" | "leaves">("daily");
  const [pendingLeavesList, setPendingLeavesList] = useState<any[]>([]);

  // Break Reject Modal States for Admin
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectRequestId, setRejectRequestId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const getISODateString = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const selectedDateISO = getISODateString(selectedDate);

  const fetchRecordsForDate = async (d: Date) => {
    const dateStr = getISODateString(d);
    setLoadingRecords(true);
    try {
      const res = await fetch(`/api/attendance?date=${dateStr}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSelectedDateRecords(data);
      } else {
        setSelectedDateRecords([]);
      }
    } catch (e) {
      setSelectedDateRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (role === "admin" || role === "super_admin" || permissions.split(",").map((p) => p.trim()).includes("manage_attendance")) {
      fetchRecordsForDate(selectedDate);
    }
  }, [selectedDate]);

  // Sync active break, request list, and pending leaves on mount & periodically
  useEffect(() => {
    const sync = async () => {
      if (role === "intern") {
        const activeRes = await getActiveBreak(currentUserEmail);
        if (activeRes.success) {
          setActiveBreak(activeRes.active || null);
        }
        const listRes = await getBreakRequests(currentUserEmail);
        if (listRes.success && listRes.requests) {
          setRequestsList(listRes.requests);
        }
      } else {
        // Admin / Tutor / Super Admin: Fetch all break requests and pending leaves
        const listRes = await getBreakRequests();
        if (listRes.success && listRes.requests) {
          setRequestsList(listRes.requests);
        }
        const leavesRes = await getPendingLeaves();
        if (leavesRes.success && leavesRes.leaves) {
          setPendingLeavesList(leavesRes.leaves);
        }
      }
    };
    
    sync();
    
    // Sync every 10 seconds
    const interval = setInterval(sync, 10000);
    return () => clearInterval(interval);
  }, [currentUserEmail, role]);

  // Countdown timer logic
  useEffect(() => {
    if (!activeBreak) return;
    const interval = setInterval(() => {
      setActiveBreak((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          remainingSeconds: Math.max(0, prev.remainingSeconds - 1),
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeBreak === null]);

  // Handle active break transition to 0
  useEffect(() => {
    if (activeBreak && activeBreak.remainingSeconds <= 0) {
      setActiveBreak(null);
      addToast("☕ Break finished! Back to work.", "success");
      getBreakRequests(currentUserEmail).then((res) => {
        if (res.success && res.requests) {
          setRequestsList(res.requests);
        }
      });
    }
  }, [activeBreak?.remainingSeconds]);

  const handleSubmitBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeBreak) {
      addToast("You already have an active break!", "error");
      return;
    }
    const hasPending = requestsList.some((r) => r.status === "pending");
    if (hasPending) {
      addToast("You already have a pending break request.", "error");
      return;
    }

    const currentUsr = users.find(u => u.email === currentUserEmail);
    if (!currentUsr) {
      addToast("User record not found.", "error");
      return;
    }

    const finalDuration = duration === "custom" ? parseInt(customDuration) : parseInt(duration);
    const finalReason = reason === "Other" ? customReason : reason;

    if (isNaN(finalDuration) || finalDuration <= 0) {
      addToast("Please enter a valid duration.", "error");
      return;
    }
    if (!finalReason.trim()) {
      addToast("Please specify a reason.", "error");
      return;
    }

    setBreakLoading(true);
    const res = await submitBreakRequest({
      userId: currentUsr.id!,
      userEmail: currentUsr.email,
      userName: currentUsr.name,
      duration: finalDuration,
      reason: finalReason,
    });
    setBreakLoading(false);

    if (res.success) {
      addToast("Break request submitted successfully!", "success");
      setDuration("30");
      setCustomDuration("");
      setReason("Tea Break");
      setCustomReason("");
      
      const listRes = await getBreakRequests(currentUserEmail);
      if (listRes.success && listRes.requests) {
        setRequestsList(listRes.requests);
      }
    } else {
      addToast(res.error || "Failed to submit request", "error");
    }
  };

  const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];

  const isUserAdmin = role === "admin";
  const isUserSuperAdmin = role === "super_admin";
  const isUserIntern = role === "intern";

  const hasPermission = (key: string) => {
    return isUserAdmin || permissions.split(",").map((p) => p.trim()).includes(key);
  };

  const canManageAttendance = isUserAdmin || hasPermission("manage_attendance");

  const todayISO = new Date().toISOString().split("T")[0];
  const currentUserJoiningDate = users.find((u) => u.email === currentUserEmail)?.createdAt?.split("T")[0] || todayISO;
  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const handleMark = async (
    email: string,
    status: string,
    date: string,
    silent = false,
    lType?: string,
    lReason?: string
  ) => {
    const res = await markAttendance(email, status, date, lType, lReason);
    if (res.success) {
      if (!silent) addToast(`${email.split("@")[0]} → ${status}`, "success");
      setRecords((prev) => {
        const existingIdx = prev.findIndex((r) => r.email === email && r.date === date);
        if (existingIdx > -1) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], status };
          return updated;
        } else {
          return [...prev, { id: Math.random(), email, date, status }];
        }
      });

      // Update selectedDateRecords locally if matching the current selectedDate
      if (date === selectedDateISO) {
        setSelectedDateRecords((prev) =>
          prev.map((r) => {
            if (r.email === email) {
              return {
                ...r,
                status: status.toLowerCase(),
                checkIn: status.toLowerCase() === "present" ? r.checkIn : "—"
              };
            }
            return r;
          })
        );
      }
    } else {
      if (!silent) addToast(res.error || "Failed to update attendance", "error");
    }
    return res;
  };

  const handleApproveBreak = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to approve break request for ${name}?`)) return;
    const currentUsr = users.find(u => u.email === currentUserEmail);
    const adminId = currentUsr?.id || 999;
    const adminName = currentUsr?.name || "Admin";
    const res = await approveBreakRequest(id, adminId, adminName);
    if (res.success) {
      addToast(`Break request approved for ${name}`, "success");
      const listRes = await getBreakRequests();
      if (listRes.success && listRes.requests) {
        setRequestsList(listRes.requests);
      }
      fetchRecordsForDate(selectedDate);
    } else {
      addToast(res.error || "Failed to approve break", "error");
    }
  };

  const handleRejectBreakClick = (id: number) => {
    setRejectRequestId(id);
    setRejectComment("");
    setIsRejectModalOpen(true);
  };

  const handleRejectBreakSubmit = async () => {
    if (!rejectRequestId) return;
    const currentUsr = users.find(u => u.email === currentUserEmail);
    const adminId = currentUsr?.id || 999;
    const adminName = currentUsr?.name || "Admin";
    const res = await rejectBreakRequest(rejectRequestId, adminId, adminName, rejectComment);
    if (res.success) {
      addToast("Break request rejected", "success");
      setIsRejectModalOpen(false);
      const listRes = await getBreakRequests();
      if (listRes.success && listRes.requests) {
        setRequestsList(listRes.requests);
      }
    } else {
      addToast(res.error || "Failed to reject break", "error");
    }
  };

  const handleApproveLeave = async (email: string, dates: string[], name: string) => {
    const dayText = dates.length === 1 ? `on ${dates[0]}` : `for ${dates.length} days (${dates[0]} to ${dates[dates.length - 1]})`;
    if (!confirm(`Approve leave request for ${name} ${dayText}?`)) return;
    const res = dates.length === 1
      ? await markAttendance(email, "Leave", dates[0], undefined, undefined, currentUserEmail)
      : await batchApproveLeave(email, dates, currentUserEmail);
    if (res.success) {
      addToast(`Leave approved for ${name} ${dayText} ✓`, "success");
      setRecords((prev) =>
        prev.map((r) =>
          r.email === email && dates.includes(r.date || "") ? { ...r, status: "Leave" } : r
        )
      );
      if (dates.includes(selectedDateISO)) {
        setSelectedDateRecords((prev) =>
          prev.map((r) => (r.email === email ? { ...r, status: "leave", checkIn: "—" } : r))
        );
      }
      const leavesRes = await getPendingLeaves();
      if (leavesRes.success && leavesRes.leaves) {
        setPendingLeavesList(leavesRes.leaves);
      }
    } else {
      addToast(res.error || "Failed to approve leave", "error");
    }
  };

  const handleRejectLeave = async (email: string, dates: string[], name: string) => {
    const dayText = dates.length === 1 ? `on ${dates[0]}` : `for ${dates.length} days (${dates[0]} to ${dates[dates.length - 1]})`;
    if (!confirm(`Reject leave request for ${name} ${dayText}?`)) return;
    const res = dates.length === 1
      ? await markAttendance(email, "Absent", dates[0])
      : await batchRejectLeave(email, dates);
    if (res.success) {
      addToast(`Leave rejected for ${name} ${dayText}`, "success");
      setRecords((prev) =>
        prev.map((r) =>
          r.email === email && dates.includes(r.date || "") ? { ...r, status: "Absent" } : r
        )
      );
      if (dates.includes(selectedDateISO)) {
        setSelectedDateRecords((prev) =>
          prev.map((r) => (r.email === email ? { ...r, status: "absent", checkIn: "—" } : r))
        );
      }
      const leavesRes = await getPendingLeaves();
      if (leavesRes.success && leavesRes.leaves) {
        setPendingLeavesList(leavesRes.leaves);
      }
    } else {
      addToast(res.error || "Failed to reject leave", "error");
    }
  };

  const markMyAttendance = async () => {
    await handleMark(currentUserEmail, "Present", todayISO);
  };

  const markMyLeave = async () => {
    if (!leaveDate || !leaveEndDate) {
      addToast("Choose start and end dates for leave", "error");
      return;
    }
    if (leaveDate < todayISO) {
      addToast("Start date must be today or a future date", "error");
      return;
    }
    if (leaveEndDate < leaveDate) {
      addToast("End date cannot be before start date", "error");
      return;
    }
    if (!leaveReason.trim()) {
      addToast("Please provide a reason for leave", "error");
      return;
    }

    setLeaveLoading(true);
    // Generate all dates in the range
    const start = new Date(leaveDate);
    const end = new Date(leaveEndDate);
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }

    let allOk = true;
    for (const d of dates) {
      const res = await handleMark(currentUserEmail, "Leave Requested", d, true, leaveType, leaveReason);
      if (!res?.success) allOk = false;
    }
    setLeaveLoading(false);

    if (allOk) {
      const dayCount = dates.length;
      addToast(`Leave request submitted for ${dayCount} day${dayCount > 1 ? "s" : ""} ✓`, "success");
      setLeaveReason("");
    }
  };

  const exportAttendance = () => {
    try {
      const csv = ["Email,Date,Status", ...records.map((a) => `${a.email},${a.date},${a.status}`)].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "attendance.csv";
      a.click();
      addToast("Exported!", "success");
    } catch (e) {
      addToast("Export failed", "error");
    }
  };

  const roleLabel = (r: string) => {
    return ({ admin: "admin", super_admin: "super admin", tutor: "tutor", intern: "intern" }[r] || r);
  };

  const roleBadge = (r: string) => {
    const cls = ({ admin: "badge-red", super_admin: "badge-purple", tutor: "badge-green", intern: "badge-blue" }[r] || "badge-gray");
    return <span className={`badge ${cls}`}>{roleLabel(r)}</span>;
  };

  const statusBadge = (s: string) => {
    const m: Record<string, string> = {
      Pending: "badge-amber",
      "In Progress": "badge-blue",
      Completed: "badge-green",
      Approved: "badge-green",
      Rejected: "badge-red",
      Present: "badge-green",
      Absent: "badge-red",
      Leave: "badge-purple",
      "Leave Requested": "badge-amber",
      "leave requested": "badge-amber",
      Weekend: "badge-gray",
      weekend: "badge-gray",
      "Not Joined Yet": "badge-gray",
      "not joined yet": "badge-gray"
    };
    return <span className={`badge ${m[s] || "badge-gray"}`}>{s}</span>;
  };

  if (!isUserIntern) {
    const yr = adminCalDate.getFullYear();
    const mo = adminCalDate.getMonth();
    const firstDay = new Date(yr, mo, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    const monthName = adminCalDate.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const handleDateClick = (day: number) => {
      setSelectedDate(new Date(yr, mo, day));
    };

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isToday = iso === todayISO;
      const isSelected = iso === selectedDateISO;
      
      // Check if any attendance record exists for this date
      const hasRecords = records.some((r) => r.date === iso);
      
      // Calculate daily counts for indicators/badges
      const dateRecords = records.filter((r) => r.date === iso);
      const presentCount = dateRecords.filter((r) => r.status === "Present").length;
      const leaveReqCount = dateRecords.filter((r) => r.status === "Leave Requested").length;
      
      const dotColor = hasRecords 
        ? (leaveReqCount > 0 ? "var(--accent)" : "var(--green)") 
        : "var(--red)";

      cells.push(
        <div
          key={`day-${d}`}
          className={`cal-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
          style={{
            textAlign: "center",
            minHeight: "75px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 4px",
            cursor: "pointer",
            borderRadius: "10px",
            border: isSelected 
              ? "2px solid var(--accent)" 
              : isToday 
              ? "1px solid var(--accent-dim)" 
              : "1px solid var(--border)",
            background: isSelected
              ? "rgba(245,158,11,0.06)"
              : isToday
              ? "var(--accent-dim)"
              : "var(--surface2)",
            boxSizing: "border-box"
          }}
          onClick={() => handleDateClick(d)}
        >
          <div
            className="cal-date"
            style={{
              fontSize: "12px",
              fontWeight: (isToday || isSelected) ? 700 : 500,
              color: isSelected ? "var(--accent)" : "var(--text)"
            }}
          >
            {d}
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
            {hasRecords ? (
              leaveReqCount > 0 ? (
                <span style={{ fontSize: "9px", color: "var(--accent)", fontWeight: 600 }}>
                  ⏳ Leave
                </span>
              ) : (
                <span style={{ fontSize: "10px", color: "var(--green)", fontWeight: 600 }}>
                  {presentCount} P
                </span>
              )
            ) : (
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>—</span>
            )}
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: dotColor,
              }}
            />
          </div>
        </div>
      );
    }

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", color: "var(--text-muted)" }}>
            📅 {todayStr}
          </div>
          <button onClick={exportAttendance} className="btn-sm btn-outline">↓ Export CSV</button>
        </div>

        <div style={{ display: "flex", gap: "24px", flexDirection: "column" }}>
          
          {/* Calendar on the Left */}
          <div className="chart-card" style={{ flex: "1 1 500px", minWidth: "320px" }}>
            <div className="cal-controls">
              <div className="cal-month">{monthName}</div>
              <div className="cal-nav">
                <button
                  type="button"
                  onClick={() =>
                    setAdminCalDate(
                      new Date(adminCalDate.getFullYear(), adminCalDate.getMonth() - 1, 1)
                    )
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const t = new Date();
                    setAdminCalDate(t);
                    setSelectedDate(t);
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAdminCalDate(
                      new Date(adminCalDate.getFullYear(), adminCalDate.getMonth() + 1, 1)
                    )
                  }
                >
                  ›
                </button>
              </div>
            </div>
            <div className="cal-grid">
              {dayHeaders.map((dh) => (
                <div key={dh} className="cal-day-header">
                  {dh}
                </div>
              ))}
              {cells}
            </div>
          </div>

          {/* Details Card on the Right (merged daily status, breaks and leaves) */}
          <div className="table-card" style={{ flex: "1 1 400px", minWidth: "320px", display: "flex", flexDirection: "column" }}>
            <div className="table-card-header" style={{ borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontFamily: "var(--font-syne)" }}>
                  📋 Attendance Dashboard
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Selected: {selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              
              {/* Tab buttons */}
              <div className="settings-tabs" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`settings-tab ${adminTab === "daily" ? "active" : ""}`}
                  onClick={() => setAdminTab("daily")}
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                >
                  Daily Status
                </button>
                <button
                  type="button"
                  className={`settings-tab ${adminTab === "breaks" ? "active" : ""}`}
                  onClick={() => setAdminTab("breaks")}
                  style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  ☕ Breaks 
                  {requestsList.filter(r => r.status === "pending").length > 0 && (
                    <span style={{ background: "var(--red)", color: "white", fontSize: "9px", padding: "2px 5px", borderRadius: "50%" }}>
                      {requestsList.filter(r => r.status === "pending").length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`settings-tab ${adminTab === "leaves" ? "active" : ""}`}
                  onClick={() => setAdminTab("leaves")}
                  style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  🏖 Leaves
                  {pendingLeavesList.length > 0 && (
                    <span style={{ background: "var(--red)", color: "white", fontSize: "9px", padding: "2px 5px", borderRadius: "50%" }}>
                      {pendingLeavesList.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="table-scroll" style={{ overflowY: "auto", maxHeight: "400px" }}>
              {adminTab === "daily" && (
                <>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: "12px", color: "var(--text-muted)" }}>
                    {selectedDateRecords.filter(r => r.status === "present").length} Present · {selectedDateRecords.filter(r => r.status === "absent").length} Absent · {selectedDateRecords.filter(r => r.status === "leave" || r.status === "leave requested").length} Leave
                  </div>
                  {loadingRecords ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      Loading records...
                    </div>
                  ) : selectedDateRecords.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      No attendance records found for this date.
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ padding: "12px 16px" }}>Employee</th>
                          <th style={{ padding: "12px 16px" }}>Status</th>
                          {canManageAttendance && <th style={{ padding: "12px 16px" }}>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDateRecords.map((rec) => {
                          const email = rec.email || "";
                          const isLeaveRequested = rec.status === "leave requested";
                          const formattedStatusText = rec.status === "present" ? "Present" : rec.status === "absent" ? "Absent" : rec.status === "leave" ? "Leave" : rec.status === "leave requested" ? "Leave Requested" : rec.status === "weekend" ? "Weekend" : rec.status === "not joined yet" ? "Not Joined Yet" : rec.status;
                          const isBeforeJoining = rec.status === "not joined yet";
                          const isWeekendStatus = rec.status === "weekend";
                          return (
                            <tr key={rec.userId}>
                              <td style={{ padding: "12px 16px", fontWeight: 600 }}>{rec.name}</td>
                              <td style={{ padding: "12px 16px" }}>
                                {statusBadge(formattedStatusText)}
                              </td>
                              {canManageAttendance && !isBeforeJoining && !isWeekendStatus && (
                                <td style={{ padding: "8px 16px" }}>
                                  {isLeaveRequested ? (
                                    <div style={{ display: "flex", gap: "6px" }}>
                                      <button
                                        type="button"
                                        className="action-btn action-approve"
                                        style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "2px" }}
                                        onClick={() => handleApproveLeave(email, [selectedDateISO], rec.name)}
                                      >
                                        🏖 Approve
                                      </button>
                                      <button
                                        type="button"
                                        className="action-btn action-reject"
                                        style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "4px" }}
                                        onClick={() => handleRejectLeave(email, [selectedDateISO], rec.name)}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", gap: "6px" }}>
                                      <button
                                        type="button"
                                        className="action-btn action-approve"
                                        style={{ padding: "3px 8px", fontSize: "11px", borderRadius: "4px" }}
                                        onClick={() => handleMark(email, "Present", selectedDateISO)}
                                      >
                                        P
                                      </button>
                                      <button
                                        type="button"
                                        className="action-btn action-reject"
                                        style={{ padding: "3px 8px", fontSize: "11px", borderRadius: "4px" }}
                                        onClick={() => handleMark(email, "Absent", selectedDateISO)}
                                      >
                                        A
                                      </button>
                                      <button
                                        type="button"
                                        className="action-btn action-edit"
                                        style={{ padding: "3px 8px", fontSize: "11px", borderRadius: "4px" }}
                                        onClick={() => handleMark(email, "Leave", selectedDateISO)}
                                      >
                                        L
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {adminTab === "breaks" && (
                <div style={{ padding: "0" }}>
                  {requestsList.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      No break requests found.
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ padding: "12px 16px" }}>Employee</th>
                          <th style={{ padding: "12px 16px" }}>Duration</th>
                          <th style={{ padding: "12px 16px" }}>Reason</th>
                          <th style={{ padding: "12px 16px" }}>Requested At</th>
                          <th style={{ padding: "12px 16px" }}>Status</th>
                          <th style={{ padding: "12px 16px" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requestsList.map((req) => (
                          <tr key={req.id}>
                            <td style={{ padding: "12px 16px" }}>
                              <strong>{req.userName}</strong>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{req.userEmail}</div>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <Clock size={12} className="text-jj-accent" />
                                <strong>{req.duration} Mins</strong>
                              </div>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {req.reason}
                              {req.rejectComment && (
                                <div style={{ fontSize: "11px", color: "var(--red)", marginTop: "2px" }}>
                                  🚫 Comment: {req.rejectComment}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-muted)" }}>
                              {new Date(req.requestedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              <div style={{ fontSize: "10.5px" }}>
                                {new Date(req.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </div>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span className={`badge ${({ pending: "badge-amber", approved: "badge-green", rejected: "badge-red", expired: "badge-gray" } as Record<string, string>)[req.status] || "badge-gray"}`}>
                                {req.status}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {req.status === "pending" ? (
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button
                                    onClick={() => handleApproveBreak(req.id, req.userName)}
                                    className="action-btn action-approve"
                                    style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "4px" }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleRejectBreakClick(req.id)}
                                    className="action-btn action-reject"
                                    style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "4px" }}
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                                  {req.approvedByName ? `Handled by ${req.approvedByName}` : "Handled"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {adminTab === "leaves" && (
                <div style={{ padding: "0" }}>
                  {pendingLeavesList.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      No pending leave requests.
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ padding: "12px 16px" }}>Employee</th>
                          <th style={{ padding: "12px 16px" }}>Type</th>
                          <th style={{ padding: "12px 16px" }}>Reason</th>
                          <th style={{ padding: "12px 16px" }}>Date(s)</th>
                          <th style={{ padding: "12px 16px" }}>Days</th>
                          <th style={{ padding: "12px 16px" }}>Status</th>
                          <th style={{ padding: "12px 16px" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingLeavesList.map((leave, idx) => (
                          <tr key={leave.email + leave.startDate}>
                            <td style={{ padding: "12px 16px" }}>
                              <strong>{leave.name}</strong>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{leave.email}</div>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{leave.leaveType || "Casual Leave"}</span>
                            </td>
                            <td style={{ padding: "12px 16px", maxWidth: "200px", wordBreak: "break-word" }}>
                              <span style={{ fontSize: "12px", color: "var(--text-soft)" }}>{leave.leaveReason || "—"}</span>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <strong>{new Date(leave.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong>
                              {leave.dayCount > 1 && (
                                <> – <strong>{new Date(leave.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ fontSize: "13px", fontWeight: 700 }}>{leave.dayCount}</span>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span className="badge badge-amber">Pending Leave</span>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  onClick={() => handleApproveLeave(leave.email, leave.dates, leave.name)}
                                  className="action-btn action-approve"
                                  style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "2px" }}
                                >
                                  🏖 Approve All
                                </button>
                                <button
                                  onClick={() => handleRejectLeave(leave.email, leave.dates, leave.name)}
                                  className="action-btn action-reject"
                                  style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "4px" }}
                                >
                                  Reject All
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Break Rejection Comment Modal */}
          <AnimatePresence>
            {isRejectModalOpen && (
              <div className="modal-shell">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="modal shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
                  style={{ maxWidth: "400px", width: "100%" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>🚫 Reject Break Request</h3>
                    <button type="button" onClick={() => setIsRejectModalOpen(false)} className="modal-close">
                      ✕
                    </button>
                  </div>

                  <div className="modal-form">
                    <div className="field">
                      <label>Reason for rejection (Optional)</label>
                      <textarea
                        placeholder="Enter rejection reason or comment..."
                        value={rejectComment}
                        onChange={(e) => setRejectComment(e.target.value)}
                        style={{
                          width: "100%",
                          minHeight: "100px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          padding: "12px",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: "13.5px",
                        }}
                      />
                    </div>

                    <div className="modal-footer" style={{ marginTop: "24px" }}>
                      <button type="button" onClick={() => setIsRejectModalOpen(false)} className="btn-sm btn-outline">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleRejectBreakSubmit}
                        className="btn-sm"
                        style={{ background: "var(--red)", color: "#fff", fontWeight: 600 }}
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </div>
      </>
    );
  }

  // Intern View - Interactive Attendance Calendar
  const todayRec = records.find((a) => a.email === currentUserEmail && a.date === todayISO);
  const todayParts = todayISO.split("-").map(Number);
  const isTodayWeekend = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]).getDay() === 0;
  const todayStatus = todayISO < currentUserJoiningDate ? "Not Joined Yet" : isTodayWeekend ? "Weekend" : todayRec ? todayRec.status : "Not Marked";

  const yr = internAttDate.getFullYear();
  const mo = internAttDate.getMonth();
  const firstDay = new Date(yr, mo, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const monthName = internAttDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const myRecords = records.filter((r) => r.email === currentUserEmail);
  const attMap: Record<string, string> = {};
  myRecords.forEach((a) => {
    if (a.date) attMap[a.date] = a.status;
  });

  let mp = 0;
  let ma = 0;
  let ml = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayOfWeek = new Date(yr, mo, d).getDay();
    const isWeekend = dayOfWeek === 0;
    const isPast = iso < todayISO;
    const isBeforeJoining = iso < currentUserJoiningDate;
    const st = attMap[iso];

    if (isBeforeJoining || isWeekend) {
      continue;
    } else if (st === "Present") {
      mp++;
    } else if (st === "Leave") {
      ml++;
    } else if (st === "Absent") {
      ma++;
    } else if (!st && isPast && !isWeekend) {
      ma++;
    }
  }

  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = iso === todayISO;
    const dayOfWeek = new Date(yr, mo, d).getDay();
    const isWeekend = dayOfWeek === 0;
    const isPast = iso < todayISO;
    const isBeforeJoining = iso < currentUserJoiningDate;
    
    let st = attMap[iso];
    let isImplicitAbsent = false;
    if (isBeforeJoining) {
      st = "Not Joined Yet";
    } else if (isWeekend) {
      st = "Weekend";
    } else if (!st && isPast) {
      st = "Absent";
      isImplicitAbsent = true;
    }

    const bgClass =
      st === "Present"
        ? { backgroundColor: "rgba(16,185,129,0.15)", borderColor: "var(--green)" }
        : st === "Absent"
        ? { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "var(--red)" }
        : st === "Leave"
        ? { backgroundColor: "rgba(139,92,246,0.12)", borderColor: "var(--purple)" }
        : st === "Leave Requested"
        ? { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "var(--amber)" }
        : st === "Weekend" || st === "Not Joined Yet"
        ? { backgroundColor: "rgba(100,116,139,0.08)", borderColor: "var(--border)", color: "var(--text-muted)" }
        : {};

    const dot =
      st === "Present" ? (
        <>
          <div className="mt-1 text-[18px] leading-none text-jj-green">✓</div>
          <div className="text-[10px] text-jj-green">Present</div>
        </>
      ) : st === "Absent" ? (
        <>
          <div className="mt-1 text-[18px] leading-none text-jj-red">✗</div>
          <div className="text-[10px] text-jj-red">{isImplicitAbsent ? "Absent (No Log)" : "Absent"}</div>
        </>
      ) : st === "Leave" ? (
        <>
          <div className="mt-1 text-[18px] leading-none text-jj-purple">🏖</div>
          <div className="text-[10px] text-jj-purple">Leave</div>
        </>
      ) : st === "Leave Requested" ? (
        <>
          <div className="mt-1 text-[18px] leading-none text-jj-amber">⏳</div>
          <div className="text-[10px] text-jj-amber" style={{ fontSize: "9px" }}>Pending</div>
        </>
      ) : st === "Weekend" ? (
        <>
          <div className="mt-1 text-[18px] leading-none" style={{ color: "var(--text-muted)" }}>—</div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Weekend</div>
        </>
      ) : st === "Not Joined Yet" ? (
        <>
          <div className="mt-1 text-[18px] leading-none" style={{ color: "var(--text-muted)" }}>—</div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Not Joined Yet</div>
        </>
      ) : null;

    cells.push(
      <div
        key={`day-${d}`}
        className={`cal-day ${isToday ? "today" : ""}`}
        style={{
          ...bgClass,
          textAlign: "center",
          minHeight: "70px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "6px 4px",
        }}
      >
        <div
          className="cal-date"
          style={isToday ? { color: "var(--accent)", fontWeight: 700 } : {}}
        >
          {d}
        </div>
        {dot}
      </div>
    );
  }

  const todayColor =
    todayStatus === "Present"
      ? "var(--green)"
      : todayStatus === "Absent"
      ? "var(--red)"
      : todayStatus === "Leave"
      ? "var(--purple)"
      : "var(--text-muted)";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", color: "var(--text-muted)" }}>
            📅 Today:{" "}
            <strong style={{ color: todayColor }}>{todayStatus}</strong>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", color: "var(--green)", border: "1px solid rgba(16,185,129,0.25)" }}>
              ✓ {mp} Present
            </span>
            <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "20px", background: "rgba(239,68,68,0.1)", color: "var(--red)", border: "1px solid rgba(239,68,68,0.25)" }}>
              ✗ {ma} Absent
            </span>
            <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "20px", background: "rgba(139,92,246,0.1)", color: "var(--purple)", border: "1px solid rgba(139,92,246,0.25)" }}>
              🏖 {ml} Leave
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {todayStatus === "Not Marked" ? (
            <button onClick={markMyAttendance} className="btn-sm btn-accent">✓ Mark Present Today</button>
          ) : todayStatus === "Not Joined Yet" ? (
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Attendance tracking has not started yet</span>
          ) : todayStatus === "Weekend" ? (
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Weekend - no attendance expected</span>
          ) : (
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Already marked for today</span>
          )}
        </div>
      </div>

      {isUserIntern && (
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
          
          {/* Card 1: Request Wellness Break */}
          <div className="surface-panel" style={{ flex: "1 1 300px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h4 style={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-syne)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              ☕ Request Wellness Break
            </h4>
            
            {activeBreak ? (
              <div style={{ textAlign: "center", padding: "16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-soft)", marginBottom: "4px" }}>
                  Active Break: <strong>{activeBreak.reason}</strong>
                </div>
                <div style={{ fontSize: "32px", fontWeight: 800, fontFamily: "var(--font-syne)", color: "var(--accent)", letterSpacing: "1px" }}>
                  {(() => {
                    const mins = Math.floor(activeBreak.remainingSeconds / 60);
                    const secs = activeBreak.remainingSeconds % 60;
                    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                  })()}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Enjoy your break! The timer will count down.
                </div>
              </div>
            ) : requestsList.some((r) => r.status === "pending") ? (
              <div style={{ textAlign: "center", padding: "20px", background: "rgba(245,158,11,0.04)", border: "1px dashed rgba(245,158,11,0.2)", borderRadius: "10px" }}>
                <div style={{ fontSize: "13px", color: "var(--accent)", fontWeight: 700 }}>⏳ Break Request Pending Approval</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-soft)", marginTop: "6px" }}>
                  Your request for a {requestsList.find(r => r.status === "pending")?.duration} minute break is awaiting admin approval.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitBreak} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)" }}>Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", color: "var(--text)", fontSize: "13px" }}
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                    <option value="90">90 Minutes</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {duration === "custom" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)" }}>Custom Duration (Minutes)</label>
                    <input
                      type="number"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      placeholder="Enter minutes"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", color: "var(--text)", fontSize: "13px" }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)" }}>Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", color: "var(--text)", fontSize: "13px" }}
                  >
                    <option value="Tea Break">Tea Break</option>
                    <option value="Lunch">Lunch</option>
                    <option value="Medical">Medical</option>
                    <option value="Personal Work">Personal Work</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {reason === "Other" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)" }}>Custom Reason</label>
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Specify reason"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", color: "var(--text)", fontSize: "13px" }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={breakLoading}
                  className="btn btn-sm btn-accent"
                  style={{ width: "100%", marginTop: "6px" }}
                >
                  {breakLoading ? "Submitting..." : "Submit Break Request"}
                </button>
              </form>
            )}
          </div>

          {/* Card 2: Request Leave */}
          <div className="surface-panel" style={{ flex: "1 1 300px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h4 style={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-syne)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              🏖 Request Leave
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>

              {/* Date range row */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 120px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)" }}>From</label>
                  <input
                    type="date"
                    value={leaveDate}
                    min={todayISO}
                    onChange={(e) => {
                      setLeaveDate(e.target.value);
                      if (leaveEndDate < e.target.value) setLeaveEndDate(e.target.value);
                    }}
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 10px", color: "var(--text)", fontSize: "13px", width: "100%" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 120px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)" }}>To</label>
                  <input
                    type="date"
                    value={leaveEndDate}
                    min={leaveDate || todayISO}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 10px", color: "var(--text)", fontSize: "13px", width: "100%" }}
                  />
                </div>
              </div>

              {/* Day count indicator */}
              {leaveDate && leaveEndDate && leaveEndDate >= leaveDate && (() => {
                const diff = Math.round((new Date(leaveEndDate).getTime() - new Date(leaveDate).getTime()) / 86400000) + 1;
                return (
                  <div style={{ fontSize: "11.5px", color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                    📅 {diff} day{diff > 1 ? "s" : ""} selected
                  </div>
                );
              })()}

              {/* Leave Type */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)" }}>Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 10px", color: "var(--text)", fontSize: "13px", width: "100%", outline: "none", cursor: "pointer" }}
                >
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Casual / Urgent Work">Casual / Urgent Work</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Reason */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-soft)" }}>Reason <span style={{ color: "var(--red)", fontSize: "11px" }}>*</span></label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Medical appointment, family event, travel…"
                  rows={3}
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 10px", color: "var(--text)", fontSize: "13px", width: "100%", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                />
              </div>

              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Leaves must be requested for today or a future date. Approved leaves will be marked on your calendar.
              </div>

              <button
                onClick={markMyLeave}
                disabled={leaveLoading}
                className="btn btn-sm btn-outline"
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
              >
                {leaveLoading ? "Submitting…" : "🏖 Submit Leave Request"}
              </button>
            </div>
          </div>

        </div>
      )}

      <div className="chart-card">
        <div className="cal-controls">
          <div className="cal-month">{monthName}</div>
          <div className="cal-nav">
            <button
              onClick={() =>
                setInternAttDate(
                  new Date(internAttDate.getFullYear(), internAttDate.getMonth() - 1, 1)
                )
              }
            >
              ‹
            </button>
            <button onClick={() => setInternAttDate(new Date())}>Today</button>
            <button
              onClick={() =>
                setInternAttDate(
                  new Date(internAttDate.getFullYear(), internAttDate.getMonth() + 1, 1)
                )
              }
            >
              ›
            </button>
          </div>
        </div>
        <div className="cal-grid">
          {dayHeaders.map((dh) => (
            <div key={dh} className="cal-day-header">
              {dh}
            </div>
          ))}
          {cells}
        </div>
      </div>
    </>
  );
}

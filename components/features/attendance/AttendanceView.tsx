"use client";

import { useUIStore } from "@/hooks/useUIStore";
import { useState, useEffect } from "react";
import { markAttendance } from "@/app/actions/attendance";

interface AttendanceRecord {
  id: number;
  email: string | null;
  date: string | null;
  status: string;
}

interface User {
  name: string;
  email: string;
  role: string;
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

  // Admin View States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [adminCalDate, setAdminCalDate] = useState<Date>(new Date());
  const [selectedDateRecords, setSelectedDateRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);

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
    if (role === "admin" || role === "super_admin") {
      fetchRecordsForDate(selectedDate);
    }
  }, [selectedDate]);

  const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];

  const isUserAdmin = role === "admin";
  const isUserSuperAdmin = role === "super_admin";
  const isUserIntern = role === "intern";

  const hasPermission = (key: string) => {
    return isUserAdmin || permissions.split(",").map((p) => p.trim()).includes(key);
  };

  const canManageAttendance = isUserAdmin || hasPermission("manage_attendance");

  const todayISO = new Date().toISOString().split("T")[0];
  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const handleMark = async (email: string, status: string, date: string) => {
    const res = await markAttendance(email, status, date);
    if (res.success) {
      addToast(`${email.split("@")[0]} → ${status}`, "success");
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
      addToast(res.error || "Failed to update attendance", "error");
    }
  };

  const markMyAttendance = async () => {
    await handleMark(currentUserEmail, "Present", todayISO);
  };

  const markMyLeave = async () => {
    if (!leaveDate) {
      addToast("Choose a date for leave", "error");
      return;
    }
    if (leaveDate < todayISO) {
      addToast("Select today or a future date for leave", "error");
      return;
    }
    await handleMark(currentUserEmail, "Leave", leaveDate);
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
    return ({ admin: "admin", super_admin: "super admin", intern: "intern" }[r] || r);
  };

  const roleBadge = (r: string) => {
    const cls = ({ admin: "badge-red", super_admin: "badge-purple", intern: "badge-blue" }[r] || "badge-gray");
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
      
      const dotColor = hasRecords ? "var(--green)" : "var(--red)";

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
              <span style={{ fontSize: "10px", color: "var(--green)", fontWeight: 600 }}>
                {presentCount} P
              </span>
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

        <div style={{ display: "flex", gap: "24px", flexDirection: "row", flexWrap: "wrap" }}>
          
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

          {/* Details Table on the Right */}
          <div className="table-card" style={{ flex: "1 1 400px", minWidth: "320px", display: "flex", flexDirection: "column" }}>
            <div className="table-card-header" style={{ borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontFamily: "var(--font-syne)" }}>
                  📋 Records: {selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {selectedDateRecords.filter(r => r.status === "present").length} Present · {selectedDateRecords.filter(r => r.status === "absent").length} Absent · {selectedDateRecords.filter(r => r.status === "leave").length} Leave
                </span>
              </div>
            </div>

            <div className="table-scroll" style={{ overflowY: "auto", maxHeight: "400px" }}>
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
                      return (
                        <tr key={rec.userId}>
                          <td style={{ padding: "12px 16px", fontWeight: 600 }}>{rec.name}</td>
                          <td style={{ padding: "12px 16px" }}>
                            {statusBadge(rec.status === "present" ? "Present" : rec.status === "absent" ? "Absent" : "Leave")}
                          </td>
                          {canManageAttendance && (
                            <td style={{ padding: "8px 16px" }}>
                              <div className="flex gap-1">
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
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </>
    );
  }

  // Intern View - Interactive Attendance Calendar
  const todayRec = records.find((a) => a.email === currentUserEmail && a.date === todayISO);
  const todayStatus = todayRec ? todayRec.status : "Not Marked";

  const yr = internAttDate.getFullYear();
  const mo = internAttDate.getMonth();
  const firstDay = new Date(yr, mo, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const monthName = internAttDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const monthPrefix = `${yr}-${String(mo + 1).padStart(2, "0")}`;
  const myRecords = records.filter((r) => r.email === currentUserEmail);
  const monthData = myRecords.filter((a) => a.date?.startsWith(monthPrefix));
  const mp = monthData.filter((a) => a.status === "Present").length;
  const ma = monthData.filter((a) => a.status === "Absent").length;
  const ml = monthData.filter((a) => a.status === "Leave").length;

  const attMap: Record<string, string> = {};
  myRecords.forEach((a) => {
    if (a.date) attMap[a.date] = a.status;
  });

  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = iso === todayISO;
    const st = attMap[iso];

    const bgClass =
      st === "Present"
        ? { backgroundColor: "rgba(16,185,129,0.15)", borderColor: "var(--green)" }
        : st === "Absent"
        ? { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "var(--red)" }
        : st === "Leave"
        ? { backgroundColor: "rgba(139,92,246,0.12)", borderColor: "var(--purple)" }
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
          <div className="text-[10px] text-jj-red">Absent</div>
        </>
      ) : st === "Leave" ? (
        <>
          <div className="mt-1 text-[18px] leading-none text-jj-purple">🏖</div>
          <div className="text-[10px] text-jj-purple">Leave</div>
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
          ) : (
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Already marked for today</span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="date"
              value={leaveDate}
              onChange={(e) => setLeaveDate(e.target.value)}
              style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "8px 10px", color: "var(--text)", fontSize: "13px" }}
            />
            <button onClick={markMyLeave} className="btn-sm btn-outline">🏖 Request Leave</button>
          </div>
        </div>
      </div>

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

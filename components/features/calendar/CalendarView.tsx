"use client";

import { useState } from "react";
import { Calendar as CalIcon, X } from "lucide-react";

interface CalendarEvent {
  type: string;
  label: string;
  color: string;
  dateStr: string; // YYYY-MM-DD
  extra?: {
    title?: string;
    description?: string;
    created_by?: string;
    time?: string;
    link?: string;
    [key: string]: string | number | boolean | undefined;
  };
}

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const monthName = currentDate.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const today = new Date();
  
  const eventsMap = events.reduce((acc, event) => {
    if (!event.dateStr) return acc;
    const key = event.dateStr.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  
  // Calculate dynamic stats for "This Month"
  const meetingsThisMonth = events.filter(
    (e) => e.type === "meeting" && e.dateStr && e.dateStr.startsWith(monthPrefix)
  ).length;

  const tasksThisMonth = events.filter(
    (e) => e.type === "task" && e.dateStr && e.dateStr.startsWith(monthPrefix)
  ).length;

  const projectDeadlinesThisMonth = events.filter(
    (e) => e.type === "project" && e.dateStr && e.dateStr.startsWith(monthPrefix)
  ).length;

  const completedTasksTotal = events.filter(
    (e) => e.type === "task" && e.color === "#10b981"
  ).length;

  // Upcoming events
  const todayStr = today.toISOString().slice(0, 10);
  
  // Group upcoming events by date
  const upcomingMap: Record<string, CalendarEvent[]> = {};
  events
    .filter((e) => e.dateStr && e.dateStr >= todayStr)
    .forEach((e) => {
      const key = e.dateStr.slice(0, 10);
      if (!upcomingMap[key]) upcomingMap[key] = [];
      upcomingMap[key].push(e);
    });

  const sortedUpcomingDates = Object.keys(upcomingMap)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 8);

  const renderCells = () => {
    const cells = [];
    // Empty cells
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(<div key={`empty-${i}`} className="cal-day empty" />);
    }
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEvents = eventsMap[dateStr] || [];

      const maxPills = 2;
      const visiblePills = dayEvents.slice(0, maxPills);
      const extraCount = dayEvents.length - maxPills;

      cells.push(
        <div
          key={`day-${d}`}
          onClick={() => dayEvents.length > 0 && setSelectedDate(dateStr)}
          className={`cal-day ${isToday ? "today" : ""} ${dayEvents.length > 0 ? "has-events" : ""}`}
          style={{
            cursor: dayEvents.length > 0 ? "pointer" : "default",
            backgroundColor: dayEvents.length > 0 ? "rgba(245,158,11,0.04)" : undefined,
          }}
        >
          <div
            className="cal-date"
            style={isToday ? { color: "var(--accent)", fontWeight: 800 } : {}}
          >
            {d}
          </div>
          <div className="cal-event-pills mt-[2px] flex flex-col gap-0.5 w-full min-w-0" style={{ maxHeight: "44px", overflow: "hidden" }}>
            {visiblePills.map((e, idx) => (
              <div
                key={idx}
                className="cal-event-pill truncate rounded-[4px] px-1 py-0.5 text-[9.5px] font-medium"
                style={{ backgroundColor: `${e.color}22`, color: e.color, maxWidth: "100%" }}
              >
                {e.label}
              </div>
            ))}
            {extraCount > 0 && (
              <div className="text-[10px] font-bold text-jj-text-muted text-center leading-tight">
                +{extraCount} more
              </div>
            )}
          </div>
        </div>
      );
    }
    return cells;
  };

  const selectedDateEvents = selectedDate ? eventsMap[selectedDate] || [] : [];
  const selectedDateLabel = selectedDate
    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[minmax(0,1fr)_300px] w-full">
      {/* Calendar Grid */}
      <div className="chart-card flex flex-col p-5 min-w-0">
        <div className="cal-controls">
          <div className="cal-month">{monthName}</div>
          <div className="cal-nav">
            <button onClick={prevMonth}>‹</button>
            <button onClick={goToToday} style={{ fontSize: "11px", padding: "4px 10px", width: "auto" }}>
              Today
            </button>
            <button onClick={nextMonth}>›</button>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-3 flex flex-wrap gap-3">
          <span className="flex items-center gap-1 text-[11.5px] text-jj-text-muted">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block"></span>
            Meeting
          </span>
          <span className="flex items-center gap-1 text-[11.5px] text-jj-text-muted">
            <span className="w-2 h-2 rounded-full bg-[#3b82f6] inline-block"></span>
            Task Deadline
          </span>
          <span className="flex items-center gap-1 text-[11.5px] text-jj-text-muted">
            <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block"></span>
            High Priority
          </span>
          <span className="flex items-center gap-1 text-[11.5px] text-jj-text-muted">
            <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block"></span>
            Completed/Joined
          </span>
          <span className="flex items-center gap-1 text-[11.5px] text-jj-text-muted">
            <span className="w-2 h-2 rounded-full bg-[#8b5cf6] inline-block"></span>
            Leave
          </span>
        </div>

        <div className="cal-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="cal-day-header">
              {d}
            </div>
          ))}
          {renderCells()}
        </div>
      </div>

      {/* Sidebar (Upcoming + Stats) */}
      <div className="flex flex-col gap-[10px]">
        {/* Upcoming Events */}
        <div className="chart-card p-4">
          <h3 className="mb-[14px] flex items-center gap-1.5 text-[13px] font-bold text-jj-text">
            <CalIcon size={14} className="text-jj-accent" /> Upcoming Events
          </h3>
          {sortedUpcomingDates.length > 0 ? (
            sortedUpcomingDates.map((date) => {
              const evts = upcomingMap[date];
              return (
                <div key={date} className="mb-3 last:mb-0">
                  <div className="mb-[5px] text-[11px] font-bold uppercase tracking-[0.5px] text-jj-text-muted">
                    {new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {evts.map((e, idx) => {
                      const emoji = e.label.slice(0, 2);
                      const text = e.label.slice(2).trim();
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedEvent(e)}
                          className="flex items-center rounded-r-[6px] border-l-[3px] pl-1 pr-2 py-1.5 w-full text-left cursor-pointer transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: `${e.color}10`,
                            borderLeftColor: e.color,
                          }}
                        >
                          <span className="w-5 flex justify-center shrink-0 text-[12.5px] select-none">
                            {emoji}
                          </span>
                          <span
                            className="text-[12px] flex-1 truncate font-medium ml-1"
                            style={{ color: e.color }}
                          >
                            {text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-jj-text-muted text-[12.5px] text-center py-5">
              No upcoming events
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="chart-card p-4">
          <h3 className="mb-3 text-[13px] font-bold">This Month</h3>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[12.5px] text-jj-text-muted">📅 Meetings</span>
              <span className="font-bold text-jj-accent">{meetingsThisMonth}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12.5px] text-jj-text-muted">📋 Task Deadlines</span>
              <span className="font-bold text-[#3b82f6]">{tasksThisMonth}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12.5px] text-jj-text-muted">🚀 Project Deadlines</span>
              <span className="font-bold" style={{ color: "#A855F7" }}>{projectDeadlinesThisMonth}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12.5px] text-jj-text-muted">✅ Completed Tasks</span>
              <span className="font-bold text-jj-green">{completedTasksTotal}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Day Events Popup Modal */}
      {selectedDate && (
        <div
          onClick={() => setSelectedDate(null)}
          className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-[1px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-jj-surface border border-jj-border rounded-[24px] w-[90vw] shadow-[0_20_60_rgba(0,0,0,0.4)] flex flex-col overflow-hidden box-border ${
              selectedDateEvents.length <= 1 ? "max-w-[340px]" : "max-w-[440px]"
            }`}
            style={{ padding: "20px" }}
          >
            {/* Header Section */}
            <div className="flex justify-between items-center shrink-0" style={{ marginBottom: "16px" }}>
              <div className="text-[14px] md:text-[15px] font-bold text-jj-text">{selectedDateLabel}</div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="w-8 h-8 flex items-center justify-center bg-none border-none text-jj-text-muted hover:text-jj-text cursor-pointer transition-colors relative shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Events Section */}
            <div className="flex flex-col overflow-y-auto max-h-[60vh] pr-1 box-border w-full" style={{ gap: "10px" }}>
              {selectedDateEvents.map((e, idx) => {
                const firstSpaceIndex = e.label.indexOf(" ");
                const icon = firstSpaceIndex !== -1 ? e.label.substring(0, firstSpaceIndex) : "";
                const text = firstSpaceIndex !== -1 ? e.label.substring(firstSpaceIndex + 1) : e.label;

                return (
                  <div
                    key={idx}
                    className="border border-opacity-30 w-full box-border flex flex-col justify-center shrink-0"
                    style={{
                      backgroundColor: `${e.color}15`,
                      borderColor: `${e.color}30`,
                      padding: "10px 14px",
                      minHeight: "48px",
                      borderRadius: "14px",
                      gap: "6px"
                    }}
                  >
                    <div className="flex items-center gap-2.5 w-full">
                      {/* Status Dot */}
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: e.color }}
                      ></div>
                      {/* Check Icon */}
                      {icon && <span className="text-[15px] flex-shrink-0">{icon}</span>}
                      {/* Candidate Name / Text */}
                      <div
                        className="text-[13px] font-semibold truncate flex-1"
                        style={{ color: e.color }}
                      >
                        {text}
                      </div>
                    </div>
                    {e.type === "meeting" && e.extra && (
                      <div className="text-[11.5px] text-jj-text-muted pl-[28px] flex flex-col gap-1 border-t border-jj-border border-opacity-10 pt-2 mt-1">
                        {e.extra.description && (
                          <div>
                            📝 <span className="text-jj-text-soft">{e.extra.description}</span>
                          </div>
                        )}
                        {e.extra.created_by && (
                          <div>
                            👤 Created by{" "}
                            <strong className="text-jj-text">{e.extra.created_by.split("@")[0]}</strong>
                          </div>
                        )}
                        {e.extra.time && e.extra.time !== "TBD" && (
                          <div>🕐 {e.extra.time}</div>
                        )}
                        {e.extra.link && (
                          <div className="mt-1">
                            <a
                              href={e.extra.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-jj-accent hover:underline font-semibold"
                            >
                              🔗 Join Meeting
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                    {e.type === "leave" && e.extra && (
                      <div className="text-[11.5px] text-jj-text-muted pl-[28px] flex flex-col gap-1 border-t border-jj-border border-opacity-10 pt-2 mt-1">
                        {e.extra.descriptionText && (
                          <div>
                            📂 <span className="text-jj-text-soft">{e.extra.descriptionText}</span>
                          </div>
                        )}
                        {e.extra.description && (
                          <div>
                            💬 Reason: <span className="text-jj-text-soft">{e.extra.description}</span>
                          </div>
                        )}
                        {e.extra.created_by && (
                          <div>
                            ✅ Approved by{" "}
                            <strong className="text-jj-text">{e.extra.time || e.extra.created_by.split("@")[0]}</strong>
                          </div>
                        )}
                        {!e.extra.created_by && (
                          <div>
                            <span className="text-jj-text-muted">Approval details not recorded</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Single Event Detail Popup */}
      {selectedEvent && (
        <div
          onClick={() => setSelectedEvent(null)}
          className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-[1px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-jj-surface border border-jj-border rounded-[24px] w-[90vw] max-w-[380px] shadow-[0_20_60_rgba(0,0,0,0.4)] flex flex-col overflow-hidden box-border"
            style={{ padding: "20px" }}
          >
            <div className="flex justify-between items-center shrink-0" style={{ marginBottom: "16px" }}>
              <div className="text-[14px] md:text-[15px] font-bold text-jj-text">
                {new Date(selectedEvent.dateStr + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="w-8 h-8 flex items-center justify-center bg-none border-none text-jj-text-muted hover:text-jj-text cursor-pointer transition-colors relative shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {(() => {
                const firstSpaceIndex = selectedEvent.label.indexOf(" ");
                const icon = firstSpaceIndex !== -1 ? selectedEvent.label.substring(0, firstSpaceIndex) : "";
                const text = firstSpaceIndex !== -1 ? selectedEvent.label.substring(firstSpaceIndex + 1) : selectedEvent.label;
                const e = selectedEvent;
                return (
                  <div
                    className="border border-opacity-30 w-full box-border flex flex-col justify-center shrink-0"
                    style={{
                      backgroundColor: `${e.color}15`,
                      borderColor: `${e.color}30`,
                      padding: "12px 16px",
                      borderRadius: "14px",
                      gap: "8px"
                    }}
                  >
                    <div className="flex items-center gap-2.5 w-full">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }}></div>
                      {icon && <span className="text-[15px] flex-shrink-0">{icon}</span>}
                      <div className="text-[13px] font-semibold truncate flex-1" style={{ color: e.color }}>
                        {text}
                      </div>
                    </div>
                    {e.type === "meeting" && e.extra && (
                      <div className="text-[11.5px] text-jj-text-muted pl-[28px] flex flex-col gap-1 border-t border-jj-border border-opacity-10 pt-2 mt-1">
                        {e.extra.description && <div>📝 <span className="text-jj-text-soft">{e.extra.description}</span></div>}
                        {e.extra.created_by && <div>👤 Created by <strong className="text-jj-text">{e.extra.created_by.split("@")[0]}</strong></div>}
                        {e.extra.time && e.extra.time !== "TBD" && <div>🕐 {e.extra.time}</div>}
                        {e.extra.link && (
                          <div className="mt-1">
                            <a href={e.extra.link} target="_blank" rel="noopener noreferrer" className="text-jj-accent hover:underline font-semibold">🔗 Join Meeting</a>
                          </div>
                        )}
                      </div>
                    )}
                    {e.type === "leave" && e.extra && (
                      <div className="text-[11.5px] text-jj-text-muted pl-[28px] flex flex-col gap-1 border-t border-jj-border border-opacity-10 pt-2 mt-1">
                        {e.extra.descriptionText && <div>📂 <span className="text-jj-text-soft">{e.extra.descriptionText}</span></div>}
                        {e.extra.description && <div>💬 Reason: <span className="text-jj-text-soft">{e.extra.description}</span></div>}
                        {e.extra.created_by ? (
                          <div>✅ Approved by <strong className="text-jj-text">{e.extra.time || e.extra.created_by.split("@")[0]}</strong></div>
                        ) : (
                          <div><span className="text-jj-text-muted">Approval details not recorded</span></div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

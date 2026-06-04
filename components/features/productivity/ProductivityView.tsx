"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/hooks/useUIStore";
import { 
  Download, TrendingUp, CheckCircle, Calendar, Trophy, X,
  MessageSquare, Briefcase, BookOpen, Heart, ShieldAlert, Star,
  Users, Mail, User, Lightbulb, AlertTriangle
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { ProductivityBreakdown, updateUserFeedback } from "@/app/actions/productivity";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export interface ProductivityStat {
  id: number;
  name: string;
  email: string;
  role: string;
  overall_score: number;
  breakdown: ProductivityBreakdown;
}

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#f97316"];

export function ProductivityView({
  stats,
  breakStats = {
    averageBreakTime: 0,
    breakRequestsToday: 0,
    longestBreak: 0,
    mostActiveUsers: []
  }
}: {
  stats: ProductivityStat[];
  breakStats?: {
    averageBreakTime: number;
    breakRequestsToday: number;
    longestBreak: number;
    mostActiveUsers: { name: string; count: number }[];
  };
}) {
  const { addToast } = useUIStore();
  const router = useRouter();
  const [selectedIntern, setSelectedIntern] = useState<ProductivityStat | null>(null);
  const [isPending, startTransition] = useTransition();

  // Feedback form state
  const [rating, setRating] = useState<string>("Good");
  const [comment, setComment] = useState<string>("");
  void breakStats;

  useEffect(() => {
    if (!selectedIntern) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedIntern(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIntern]);

  if (!stats.length) {
    return (
      <div className="surface-panel flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-3 text-[32px]">📊</div>
        <div className="text-[14px] text-jj-text-muted">
          No intern data yet. Assign tasks and mark attendance to see scores.
        </div>
      </div>
    );
  }

  const avgScore = Math.round(stats.reduce((s, i) => s + i.overall_score, 0) / stats.length);
  const totalDone = stats.reduce((s, i) => s + i.breakdown.tasks.completed, 0);
  const totalPres = stats.reduce((s, i) => s + i.breakdown.attendance.present, 0);
  const top = stats[0];

  const getGrade = (s: number) => {
    if (s >= 90) return "A+";
    if (s >= 80) return "A";
    if (s >= 70) return "B";
    if (s >= 60) return "C";
    if (s >= 50) return "D";
    return "F";
  };

  const getScoreColor = (s: number) => {
    if (s >= 90) return "#10b981";
    if (s >= 75) return "#3b82f6";
    if (s >= 60) return "#f59e0b";
    return "#ef4444";
  };

  const getGaugeColor = (s: number) => {
    if (s >= 90) return "#10b981";
    if (s >= 60) return "#f59e0b";
    return "#ef4444";
  };

  const getScoreTextColor = (s: number | null) => {
    if (s === null) return "text-jj-text-muted";
    if (s >= 90) return "text-emerald-400";
    if (s >= 75) return "text-blue-400";
    if (s >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreFillClass = (s: number | null) => {
    if (s === null) return "bg-transparent";
    if (s >= 90) return "bg-emerald-500";
    if (s >= 75) return "bg-blue-500";
    if (s >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const exportProductivity = () => {
    const header = "Rank,Name,Email,Attendance Score,Tasks Score,Projects Score,Work Logs Score,Meetings Score,Comm Score,Breaks Score,Feedback Rating,Overall Score,Grade";
    const rows = stats.map((s, i) =>
      `${i + 1},"${s.name}",${s.email},${s.breakdown.attendance.score}%,${s.breakdown.tasks.score}%,${s.breakdown.projects.score}%,${s.breakdown.workLogs.score}%,${s.breakdown.meetings.score}%,${s.breakdown.communication.score}%,${s.breakdown.breaks.score}%,"${s.breakdown.feedback.rating}",${s.overall_score}%,${getGrade(s.overall_score)}`
    );
    const csv = [header, ...rows].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "productivity_report.csv");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addToast(`Exported ${stats.length} interns!`, "success");
  };

  const chartNames = stats.map((s) => s.name.split(" ")[0]);

  const scoreData = {
    labels: chartNames,
    datasets: [
      {
        label: "Overall %",
        data: stats.map((s) => s.overall_score),
        backgroundColor: stats.map((s) => getScoreColor(s.overall_score) + "cc"),
        borderRadius: 8,
        barThickness: 32,
      },
    ],
  };

  const taskData = {
    labels: chartNames,
    datasets: [
      {
        label: "Completed",
        data: stats.map((s) => s.breakdown.tasks.completed),
        backgroundColor: "rgba(16,185,129,0.8)",
        borderRadius: 4,
        barThickness: 14,
      },
      {
        label: "Overdue",
        data: stats.map((s) => s.breakdown.tasks.overdue),
        backgroundColor: "rgba(239,68,68,0.7)",
        borderRadius: 4,
        barThickness: 14,
      },
      {
        label: "Remaining",
        data: stats.map((s) => {
          const remaining = s.breakdown.tasks.total - s.breakdown.tasks.completed - s.breakdown.tasks.overdue;
          return Math.max(0, remaining);
        }),
        backgroundColor: "rgba(59,130,246,0.5)",
        borderRadius: 4,
        barThickness: 14,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(150, 150, 150, 0.1)" },
        ticks: { color: "#8a8f98" },
      },
      x: {
        grid: { display: false },
        ticks: { color: "#8a8f98" },
      },
    },
    plugins: {
      legend: { labels: { color: "#8a8f98", font: { size: 12 } } },
    },
  };

  type InsightTone = "positive" | "warning" | "neutral";

  const hasNoPerformanceData = (s: ProductivityStat) =>
    s.breakdown.projects.total === 0 &&
    s.breakdown.tasks.total === 0 &&
    s.breakdown.workLogs.count === 0;

  const getTeamRankLabel = (s: ProductivityStat) => {
    const rank = stats.findIndex((item) => item.id === s.id) + 1;
    if (rank <= 0 || stats.length <= 1) return "Team benchmark";

    const percentile = Math.max(1, Math.round((rank / stats.length) * 100));
    return rank === 1 ? "Top performer" : `Top ${percentile}% of Team`;
  };

  // Generate automated performance insights
  const generateInsights = (s: ProductivityStat): { tone: InsightTone; text: string }[] => {
    const insights: { tone: InsightTone; text: string }[] = [];
    const b = s.breakdown;
    const totalAttendanceDays = b.attendance.present + b.attendance.absent + b.attendance.leave;

    if (b.tasks.overdue > 0) {
      insights.push({ tone: "warning", text: `${b.tasks.overdue} overdue task${b.tasks.overdue === 1 ? "" : "s"} need manager follow-up.` });
    } else if (b.tasks.total > 0) {
      insights.push({ tone: "positive", text: "No overdue tasks in the current review period." });
    }

    if (totalAttendanceDays === 0) {
      insights.push({ tone: "warning", text: "No attendance records available for this period." });
    } else if (b.attendance.rate >= 0.95 && b.attendance.lateCount === 0) {
      insights.push({ tone: "positive", text: "Perfect attendance and punctual check-ins." });
    } else if (b.attendance.lateCount > 2) {
      insights.push({ tone: "warning", text: `Late check-ins recorded ${b.attendance.lateCount} times.` });
    }

    if (b.breaks.excessiveFlags.length > 0) {
      b.breaks.excessiveFlags.forEach(flag => {
        insights.push({ tone: "warning", text: `Wellness break alert: ${flag}.` });
      });
    } else if (b.breaks.count > 0 || b.breaks.duration > 0) {
      insights.push({ tone: "positive", text: "Break behavior is within the expected wellness range." });
    }

    if (b.workLogs.count === 0) {
      insights.push({ tone: "warning", text: "No work logs submitted in the review period." });
    } else if (b.workLogs.avgWordCount < 8) {
      insights.push({ tone: "warning", text: `Work logs are brief, averaging ${Math.round(b.workLogs.avgWordCount)} words.` });
    } else {
      insights.push({ tone: "positive", text: "Work logs show consistent documentation habits." });
    }

    if (b.tasks.completed > 0 && b.tasks.avgCompletionHours > 0 && b.tasks.avgCompletionHours < 24) {
      insights.push({ tone: "positive", text: "Tasks are completed in under 24 hours on average." });
    }

    if (b.feedback.rating === "Excellent") {
      insights.push({ tone: "positive", text: "Manager feedback identifies this employee as an excellent performer." });
    }

    if (b.communication.count === 0) {
      insights.push({ tone: "warning", text: "Limited communication activity recorded." });
    } else if (b.communication.count <= 5) {
      insights.push({ tone: "neutral", text: "Communication volume is light but present." });
    }

    if (insights.length === 0) {
      insights.push({ tone: "neutral", text: "Performance is steady across available metrics." });
    }

    while (insights.length < 3) {
      insights.push({ tone: "neutral", text: "More activity data will improve review confidence." });
    }

    return insights.slice(0, 5);
  };

  const handleOpenModal = (intern: ProductivityStat) => {
    setSelectedIntern(intern);
    setRating(intern.breakdown.feedback.rating || "Good");
    setComment(intern.breakdown.feedback.comment || "");
  };

  const handleSaveFeedback = () => {
    if (!selectedIntern) return;

    startTransition(async () => {
      const res = await updateUserFeedback(selectedIntern.id, rating, comment);
      if (res.success) {
        addToast(`Feedback updated for ${selectedIntern.name}!`, "success");
        // Update local modal data
        const updatedStats = {
          ...selectedIntern,
          breakdown: {
            ...selectedIntern.breakdown,
            feedback: {
              ...selectedIntern.breakdown.feedback,
              rating,
              comment
            }
          }
        };
        setSelectedIntern(updatedStats);
        router.refresh();
      } else {
        addToast(res.error || "Failed to update feedback", "error");
      }
    });
  };

  return (
    <div className="page-stack !h-auto">
      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-icon green">
            <TrendingUp size={24} />
          </div>
          <div className="stat-value">{avgScore}%</div>
          <div className="stat-label">Avg Team Score</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon amber">
            <CheckCircle size={24} />
          </div>
          <div className="stat-value">{totalDone}</div>
          <div className="stat-label">Tasks Completed</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue">
            <Calendar size={24} />
          </div>
          <div className="stat-value">{totalPres}</div>
          <div className="stat-label">Total Present Days</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon purple">
            <Trophy size={24} />
          </div>
          <div className="stat-value text-[22px]">{top ? top.name.split(" ")[0] : "—"}</div>
          <div className="stat-label">Top Performer {top ? `(${top.overall_score}%)` : ""}</div>
        </div>
      </div>



      {/* Chart Section */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Overall Score per Intern</h3>
          <div className="h-[250px] w-full">
            <Bar data={scoreData} options={chartOptions} />
          </div>
        </div>
        <div className="chart-card">
          <h3>Tasks Breakdown</h3>
          <div className="h-[250px] w-full">
            <Bar data={taskData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Intern Rankings Table */}
      <div className="table-shell padded-table">
        <div className="surface-header !py-5 !px-6 border-b border-jj-border">
          <div>
            <h3 className="surface-title">Intern Performance Details</h3>
            <p className="text-[12px] text-jj-text-muted mt-1">Click on any intern row to view the detailed multi-factor breakdown, automated insights, and update manager feedback.</p>
          </div>
          <button
            onClick={exportProductivity}
            className="btn-sm btn-outline flex items-center gap-1.5"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="table-scroll">
          <table className="whitespace-nowrap">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Intern</th>
                <th>Overall Score</th>
                <th>Grade</th>
                <th>Tasks Score</th>
                <th>Att. Score</th>
                <th>Breaks Score</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, idx) => {
                const col = COLORS[idx % COLORS.length];
                const gc = getScoreColor(s.overall_score);
                const ts_c = getScoreColor(s.breakdown.tasks.score);
                const as_c = getScoreColor(s.breakdown.attendance.score);
                const bs_c = getScoreColor(s.breakdown.breaks.score);
                const grade = getGrade(s.overall_score);

                return (
                  <tr 
                    key={s.email} 
                    onClick={() => handleOpenModal(s)}
                    className="cursor-pointer hover:bg-jj-bg-muted transition-colors"
                  >
                    <td className="font-bold text-[14px]" style={{ color: idx === 0 ? "#f59e0b" : idx === 1 ? "#9ca3af" : "#6b7280" }}>
                      #{idx + 1}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold shrink-0"
                          style={{ backgroundColor: `${col}22`, color: col }}
                        >
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-[13px]">{s.name}</div>
                          <div className="text-[11px] text-jj-text-muted">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-[70px] overflow-hidden rounded-full bg-jj-border">
                          <div className="h-full rounded-full animate-pulse" style={{ width: `${s.overall_score}%`, backgroundColor: gc }} />
                        </div>
                        <span className="text-[13px] font-bold" style={{ color: gc }}>{s.overall_score}%</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-[16px] font-extrabold" style={{ color: gc }}>{grade}</span>
                    </td>
                    <td>
                      <span className="text-[12px] font-semibold" style={{ color: ts_c }}>{s.breakdown.tasks.score}%</span>
                      <div className="text-[10px] text-jj-text-muted">{s.breakdown.tasks.completed}/{s.breakdown.tasks.total} done</div>
                    </td>
                    <td>
                      <span className="text-[12px] font-semibold" style={{ color: as_c }}>{s.breakdown.attendance.score}%</span>
                      <div className="text-[10px] text-jj-text-muted">✅{s.breakdown.attendance.present} ❌{s.breakdown.attendance.absent}</div>
                    </td>

                    <td>
                      <span className="text-[12px] font-semibold" style={{ color: bs_c }}>{s.breakdown.breaks.score}%</span>
                      <div className="text-[10px] text-jj-text-muted">{s.breakdown.breaks.count} breaks ({s.breakdown.breaks.duration}m)</div>
                    </td>
                    <td>
                      <span className={`badge-sm ${
                        s.breakdown.feedback.rating === "Excellent" ? "green" : 
                        s.breakdown.feedback.rating === "Good" ? "blue" : 
                        s.breakdown.feedback.rating === "Average" ? "amber" : "red"
                      }`}>
                        {s.breakdown.feedback.rating}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Intern Detail Modal */}
      {selectedIntern && (() => {
        const b = selectedIntern.breakdown;
        const totalAttendanceDays = b.attendance.present + b.attendance.absent + b.attendance.leave;
        const noPerformanceData = hasNoPerformanceData(selectedIntern);
        const gaugeRadius = 94;
        const gaugeSize = 220;
        const gaugeCircumference = 2 * Math.PI * gaugeRadius;
        const metricCards = [
          {
            label: "Attendance",
            weight: b.attendance.weight,
            icon: Calendar,
            score: totalAttendanceDays > 0 ? b.attendance.score : null,
            detail: `Present ${b.attendance.present}d · Absent ${b.attendance.absent}d · Leave ${b.attendance.leave}d · Late ${b.attendance.lateCount}`,
          },
          {
            label: "Task Completion",
            weight: b.tasks.weight,
            icon: CheckCircle,
            score: b.tasks.total > 0 ? b.tasks.score : null,
            detail: `Completed ${b.tasks.completed}/${b.tasks.total} · Overdue ${b.tasks.overdue} · Avg ${b.tasks.avgCompletionHours > 0 ? `${Math.round(b.tasks.avgCompletionHours)} hrs` : "N/A"}`,
          },
          {
            label: "Projects",
            weight: b.projects.weight,
            icon: Briefcase,
            score: b.projects.total > 0 ? b.projects.score : null,
            detail: `Assigned ${b.projects.total} · Completed ${b.projects.completed} · Led ${b.projects.led}`,
          },
          {
            label: "Work Logs",
            weight: b.workLogs.weight,
            icon: BookOpen,
            score: b.workLogs.count > 0 ? b.workLogs.score : null,
            detail: `Submitted ${b.workLogs.count} · Consistency ${Math.round(b.workLogs.consistency * 100)}% · Avg ${Math.round(b.workLogs.avgWordCount)} words`,
          },
          {
            label: "Meetings",
            weight: b.meetings.weight,
            icon: Users,
            score: b.meetings.invited > 0 ? b.meetings.score : null,
            detail: `Attended ${b.meetings.attended}/${b.meetings.invited} · Excused ${b.meetings.excused}`,
          },
          {
            label: "Communication",
            weight: b.communication.weight,
            icon: MessageSquare,
            score: b.communication.count > 0 ? b.communication.score : null,
            detail: `Sent messages ${b.communication.count}`,
          },
          {
            label: "Breaks",
            weight: b.breaks.weight,
            icon: Heart,
            score: b.breaks.count > 0 || b.breaks.duration > 0 || b.breaks.unapprovedCount > 0 || b.breaks.excessiveFlags.length > 0 ? b.breaks.score : null,
            detail: `Approved ${b.breaks.count} · Duration ${b.breaks.duration}m · Rejected ${b.breaks.unapprovedCount} · Flags ${b.breaks.excessiveFlags.length || "None"}`,
          },
        ];

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm transition-opacity sm:p-4"
            onClick={() => setSelectedIntern(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="performance-modal-title"
              className="relative flex max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-xl border border-jj-border bg-jj-bg-surface shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className="flex items-start justify-between gap-4 border-b border-jj-border"
                style={{ padding: "24px 32px" }}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-jj-border bg-jj-bg-muted/50 text-jj-text-soft">
                      <User size={20} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h2 id="performance-modal-title" className="truncate text-[20px] font-bold leading-tight text-jj-text-main font-syne">
                        {selectedIntern.name}
                      </h2>
                      <p className="mt-1 text-[13px] text-jj-text-muted">
                        Intern · Data Science
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 text-[13px] text-jj-text-muted sm:flex-row sm:items-center sm:gap-5">
                    <span className="inline-flex items-center gap-2">
                      <Mail size={14} aria-hidden="true" />
                      <span className="break-all">{selectedIntern.email}</span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Calendar size={14} aria-hidden="true" />
                      <span className="text-jj-text-soft">Performance Period:</span> Last 30 Days
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIntern(null)}
                  aria-label="Close performance evaluation"
                  className="rounded-lg p-2 text-jj-text-muted transition-colors hover:bg-jj-bg-muted hover:text-jj-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div 
                className="overflow-y-auto"
                style={{ padding: "24px 32px" }}
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
                  {/* Left Column: Summary & Insights */}
                  <div className="flex flex-col gap-6">
                    <section 
                      className="surface-panel flex flex-col items-center justify-center text-center" 
                      style={{ padding: "28px" }}
                      aria-label="Overall performance score"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-jj-text-muted">Overall Score</span>
                      <div className="relative mt-5 flex h-[220px] w-[220px] items-center justify-center">
                        <svg className="h-[220px] w-[220px] -rotate-90" viewBox={`0 0 ${gaugeSize} ${gaugeSize}`} aria-hidden="true">
                          <circle
                            cx={gaugeSize / 2}
                            cy={gaugeSize / 2}
                            r={gaugeRadius}
                            stroke="rgba(var(--text-muted-rgb), 0.14)"
                            strokeWidth="14"
                            fill="transparent"
                          />
                          <circle
                            cx={gaugeSize / 2}
                            cy={gaugeSize / 2}
                            r={gaugeRadius}
                            stroke={getGaugeColor(selectedIntern.overall_score)}
                            strokeWidth="14"
                            fill="transparent"
                            strokeDasharray={gaugeCircumference}
                            strokeDashoffset={gaugeCircumference * (1 - selectedIntern.overall_score / 100)}
                            strokeLinecap="round"
                            className="transition-all duration-700 ease-out"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-[54px] font-extrabold leading-none text-jj-text-main">
                            {selectedIntern.overall_score}
                          </span>
                          <span className="mt-2 text-[13px] font-medium text-jj-text-muted">Performance Score</span>
                        </div>
                      </div>
                      <div className="mt-5 flex items-center gap-2">
                        <span className="rounded-full border border-jj-border bg-jj-bg-muted/60 px-3 py-1 text-[12px] font-bold text-jj-text-main">
                          Grade {getGrade(selectedIntern.overall_score)}
                        </span>
                        <span className="rounded-full border border-jj-border bg-jj-bg-muted/30 px-3 py-1 text-[12px] font-semibold text-jj-text-muted">
                          {getTeamRankLabel(selectedIntern)}
                        </span>
                      </div>
                    </section>

                    <section 
                      className="surface-panel" 
                      style={{ padding: "28px" }}
                      aria-labelledby="insights-title"
                    >
                      <h3 id="insights-title" className="flex items-center gap-2 text-[14px] font-bold text-jj-text-main">
                        <Lightbulb size={16} className="text-amber-400" aria-hidden="true" />
                        Key Insights
                      </h3>
                      <div className="mt-4 flex flex-col gap-2">
                        {generateInsights(selectedIntern).map((insight, idx) => (
                          <div
                            key={`${insight.text}-${idx}`}
                            className={`flex gap-3 rounded-lg border text-[12px] leading-relaxed ${
                              insight.tone === "positive"
                                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                                : insight.tone === "warning"
                                  ? "border-amber-500/20 bg-amber-500/5 text-amber-200"
                                  : "border-jj-border bg-jj-bg-muted/30 text-jj-text-muted"
                            }`}
                            style={{ padding: "14px 18px" }}
                          >
                            {insight.tone === "positive" ? (
                              <CheckCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                            ) : insight.tone === "warning" ? (
                              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                            ) : (
                              <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                            )}
                            <span>{insight.text}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Performance Breakdown & Evaluation */}
                  <div className="flex flex-col gap-6">
                    <section 
                      className="surface-panel" 
                      style={{ padding: "28px" }}
                      aria-labelledby="breakdown-title"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3 border-b border-jj-border/60 pb-3">
                        <div>
                          <h3 id="breakdown-title" className="text-[14px] font-bold text-jj-text-main">Performance Breakdown</h3>
                          <p className="mt-1 text-[12px] text-jj-text-muted">Weighted metrics for the last 30 days</p>
                        </div>
                        <span className="hidden rounded-full bg-jj-bg-muted px-3 py-1 text-[11px] font-semibold text-jj-text-muted sm:inline-flex">
                          Total weight 95%
                        </span>
                      </div>

                      {noPerformanceData ? (
                        <div className="rounded-xl border border-dashed border-jj-border bg-jj-bg-muted/20 p-5 text-[13px] text-jj-text-muted">
                          No performance data available yet.
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {metricCards.map((metric) => {
                          const Icon = metric.icon;
                          const scoreLabel = metric.score === null ? "No Data" : `${metric.score}%`;
                          return (
                            <article 
                              key={metric.label} 
                              className="rounded-xl border border-jj-border bg-jj-bg-muted/20"
                              style={{ padding: "18px" }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 text-[13px] font-semibold text-jj-text-main">
                                    <Icon size={15} className="text-jj-text-muted" aria-hidden="true" />
                                    <span>{metric.label}</span>
                                  </div>
                                  <div className="mt-1 text-[11px] text-jj-text-muted">{metric.weight}% weight</div>
                                </div>
                                <span className={`text-[15px] font-bold ${getScoreTextColor(metric.score)}`}>{scoreLabel}</span>
                              </div>
                              <div
                                className="mb-4 mt-2 h-2.5 overflow-hidden rounded-full bg-jj-border/70"
                                role={metric.score === null ? undefined : "progressbar"}
                                aria-label={`${metric.label} score`}
                                aria-valuenow={metric.score ?? undefined}
                                aria-valuemin={metric.score === null ? undefined : 0}
                                aria-valuemax={metric.score === null ? undefined : 100}
                              >
                                <div
                                  className={`h-full rounded-full ${getScoreFillClass(metric.score)}`}
                                  style={{ width: `${metric.score ?? 0}%` }}
                                />
                              </div>
                              <p className="text-[11px] leading-relaxed text-jj-text-muted">{metric.detail}</p>
                            </article>
                          );
                        })}
                      </div>
                    </section>

                    <section 
                      className="surface-panel" 
                      style={{ padding: "28px" }}
                      aria-labelledby="manager-review-title"
                    >
                      <h3 id="manager-review-title" className="flex items-center gap-2 text-[14px] font-bold text-jj-text-main">
                        <Star size={16} className="text-amber-400" aria-hidden="true" />
                        Manager Evaluation
                      </h3>

                      <div className="mt-4">
                        <div className="mb-2 text-[12px] font-semibold text-jj-text-muted">Rating</div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Manager rating">
                          {["Excellent", "Good", "Average", "Needs Improvement"].map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              role="radio"
                              aria-checked={rating === lvl}
                              onClick={() => setRating(lvl)}
                              className={`min-h-11 rounded-lg border px-4 text-[12px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                rating === lvl
                                  ? "border-blue-500 bg-blue-500/15 text-blue-200"
                                  : "border-jj-border bg-jj-bg-muted/20 text-jj-text-muted hover:bg-jj-bg-muted/50"
                              }`}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-2">
                        <label htmlFor="review-notes" className="text-[12px] font-semibold text-jj-text-muted">Review Notes</label>
                        <textarea
                          id="review-notes"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Add performance feedback, achievements, strengths, or areas for improvement..."
                          className="max-h-[140px] min-h-[100px] w-full resize-y rounded-lg border border-jj-border bg-jj-bg-muted/20 text-[13px] leading-relaxed text-jj-text-main placeholder:text-jj-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ padding: "16px" }}
                        />
                      </div>
                    </section>
                  </div>
                </div>
              </div>

              <div 
                className="sticky bottom-0 flex justify-end gap-3 border-t border-jj-border bg-jj-bg-surface"
                style={{ padding: "16px 32px" }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedIntern(null)}
                  className="h-12 rounded-lg border border-jj-border bg-transparent px-5 text-[13px] font-bold text-jj-text-muted transition-colors hover:bg-jj-bg-muted hover:text-jj-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveFeedback}
                  disabled={isPending}
                  className="flex h-12 min-w-[140px] items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 text-[13px] font-bold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-jj-bg-surface"
                >
                  {isPending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Star size={14} fill="currentColor" aria-hidden="true" />
                      Save Review
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

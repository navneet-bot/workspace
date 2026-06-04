"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { deleteExpiredMeetings } from "@/app/actions/meetings";

export interface ProductivityBreakdown {
  attendance: { score: number; rate: number; lateCount: number; present: number; absent: number; leave: number; weight: number };
  tasks: { score: number; completed: number; total: number; overdue: number; avgCompletionHours: number; weight: number };
  projects: { score: number; completed: number; total: number; led: number; weight: number };
  workLogs: { score: number; count: number; consistency: number; avgWordCount: number; weight: number };
  meetings: { score: number; attended: number; invited: number; excused: number; weight: number };
  communication: { score: number; count: number; weight: number };
  breaks: { score: number; count: number; duration: number; unapprovedCount: number; excessiveFlags: string[]; weight: number };
  feedback: { score: number; rating: string; comment: string; weight: number };
  overall: number;
}

// Internal function to calculate productivity metrics for a user
function calculateUserProductivity(
  user: any,
  tasks: any[],
  projects: any[],
  attendance: any[],
  workLogs: any[],
  meetings: any[],
  chatMessages: any[],
  groupMessages: any[],
  breakRequests: any[]
): ProductivityBreakdown {
  const email = user.email;
  const userId = user.id;
  const currentDate = new Date();

  // 1. Attendance (20%)
  const userAtt = attendance.filter((a) => a.email === email);
  const present = userAtt.filter((a) => a.status === "Present").length;
  const absent = userAtt.filter((a) => a.status === "Absent").length;
  const leave = userAtt.filter((a) => a.status === "Leave").length;
  const totalDays = present + absent + leave;
  const attendanceRate = totalDays > 0 ? present / totalDays : 1.0;

  // Late check-ins calculation
  const userLogs = workLogs.filter((wl) => wl.email === email);
  let lateCount = 0;
  userLogs.forEach((wl) => {
    if (wl.loginTime) {
      try {
        const d = new Date(wl.loginTime);
        if (!isNaN(d.getTime())) {
          const hours = d.getHours();
          const minutes = d.getMinutes();
          if (hours > 10 || (hours === 10 && minutes > 0)) {
            lateCount++;
          }
        } else {
          const matches = wl.loginTime.match(/(\d{2}):(\d{2})/);
          if (matches) {
            const hours = parseInt(matches[1]);
            const minutes = parseInt(matches[2]);
            if (hours > 10 || (hours === 10 && minutes > 0)) {
              lateCount++;
            }
          }
        }
      } catch (e) {
        // ignore parsing errors
      }
    }
  });

  let attScore = attendanceRate * 100 - lateCount * 5;
  attScore = Math.max(0, Math.min(100, attScore));

  // 2. Tasks (30%)
  const userTasks = tasks.filter((t) => t.assignedTo === email);
  const tasksTotal = userTasks.length;
  const tasksCompleted = userTasks.filter((t) => t.status === "Completed").length;
  
  // Overdue count: deadline passed and status is not Completed
  const overdueCount = userTasks.filter((t) => {
    if (t.status === "Completed") return false;
    if (!t.deadline || t.deadline === "TBD") return false;
    try {
      const deadlineDate = new Date(t.deadline);
      return !isNaN(deadlineDate.getTime()) && deadlineDate < currentDate;
    } catch {
      return false;
    }
  }).length;

  // Average Completion Time in Hours
  let totalCompletionHours = 0;
  let completedWithTimeCount = 0;
  userTasks.forEach((t) => {
    if (t.status === "Completed" && t.completedAt) {
      const completedTime = new Date(t.completedAt).getTime();
      const createdTime = new Date(t.createdAt).getTime();
      const diffHours = (completedTime - createdTime) / (1000 * 60 * 60);
      if (diffHours > 0) {
        totalCompletionHours += diffHours;
        completedWithTimeCount++;
      }
    }
  });
  const avgCompletionHours = completedWithTimeCount > 0 ? totalCompletionHours / completedWithTimeCount : 0;

  let taskScore = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 100;
  // Overdue task penalties
  taskScore -= overdueCount * 10;
  // Completion speed adjustments
  if (avgCompletionHours > 0) {
    if (avgCompletionHours <= 24) {
      taskScore += 5; // Fast completion bonus
    } else if (avgCompletionHours > 120) {
      taskScore -= 5; // Slow completion penalty
    }
  }
  taskScore = Math.max(0, Math.min(100, taskScore));

  // 3. Projects (20%)
  const userProjects = projects.filter((p) => {
    try {
      const membersList = p.members ? JSON.parse(p.members) : [];
      return Array.isArray(membersList) && membersList.includes(email);
    } catch {
      return p.members && p.members.includes(email);
    }
  });
  const projectsTotal = userProjects.length;
  const projectsCompleted = userProjects.filter((p) => p.status === "Completed").length;
  const projectsLed = projects.filter((p) => p.createdBy === email).length;

  let projectScore = projectsTotal > 0 ? (projectsCompleted / projectsTotal) * 100 : 100;
  // Led projects bonus
  projectScore += projectsLed * 10;
  projectScore = Math.max(0, Math.min(100, projectScore));

  // 4. Work Logs (10%)
  // consistency: log entries per present days
  const activeDays = Math.max(present, 1);
  const consistencyRate = Math.min(1.0, userLogs.length / activeDays);
  
  // Word count analysis
  let totalWordCount = 0;
  userLogs.forEach((wl) => {
    const text = `${wl.workAssigned || ""} ${wl.workDid || ""}`;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    totalWordCount += words.length;
  });
  const avgWordCount = userLogs.length > 0 ? totalWordCount / userLogs.length : 0;

  const consistencyScore = consistencyRate * 100;
  const wordCountScore = avgWordCount >= 15 ? 100 : avgWordCount >= 5 ? 85 : 50;
  let workLogScore = consistencyScore * 0.7 + wordCountScore * 0.3;
  workLogScore = Math.max(0, Math.min(100, workLogScore));

  // 5. Meetings (5%)
  const userMeetings = meetings.filter((m) => {
    try {
      const membersList = m.members ? JSON.parse(m.members) : [];
      return Array.isArray(membersList) && membersList.includes(email);
    } catch {
      return m.members && m.members.includes(email);
    }
  });

  let attendedCount = 0;
  let excusedCount = 0;
  userMeetings.forEach((m) => {
    if (m.date) {
      // check user attendance on meeting date
      const attRecord = userAtt.find((a) => a.date === m.date);
      if (attRecord) {
        if (attRecord.status === "Absent" || attRecord.status === "Leave") {
          excusedCount++;
        } else if (attRecord.status === "Present") {
          attendedCount++;
        }
      } else {
        // assume attended if not marked absent/leave
        attendedCount++;
      }
    } else {
      attendedCount++;
    }
  });

  const invitedCount = userMeetings.length;
  const effectiveInvited = invitedCount - excusedCount;
  let meetingScore = effectiveInvited > 0 ? (attendedCount / effectiveInvited) * 100 : 100;
  meetingScore = Math.max(0, Math.min(100, meetingScore));

  // 6. Communication (5%)
  const chatSentCount = chatMessages.filter((cm) => cm.senderId === userId).length;
  const groupSentCount = groupMessages.filter((gm) => gm.sender === email).length;
  const totalMessages = chatSentCount + groupSentCount;

  let commScore = 30; // base score for 0 messages
  if (totalMessages > 0 && totalMessages <= 5) {
    commScore = 75;
  } else if (totalMessages > 5 && totalMessages <= 50) {
    commScore = 100;
  } else if (totalMessages > 50) {
    commScore = 95; // minor spam limit
  }

  // 7. Break Behaviour (5%)
  const userBreaks = breakRequests.filter((b) => b.userEmail === email);
  const approvedBreaks = userBreaks.filter((b) => b.status === "approved" || b.status === "expired");
  const unapprovedCount = userBreaks.filter((b) => b.status === "rejected").length;
  const totalBreakDuration = approvedBreaks.reduce((sum, b) => sum + b.duration, 0);

  // Group approved breaks by date
  const breaksByDate: Record<string, { count: number; duration: number }> = {};
  approvedBreaks.forEach((b) => {
    const dateKey = new Date(b.createdAt).toISOString().slice(0, 10);
    if (!breaksByDate[dateKey]) {
      breaksByDate[dateKey] = { count: 0, duration: 0 };
    }
    breaksByDate[dateKey].count++;
    breaksByDate[dateKey].duration += b.duration;
  });

  const excessiveFlags: string[] = [];
  let dailyCountLimitExceeded = false;
  let dailyDurationLimitExceeded = false;

  Object.entries(breaksByDate).forEach(([date, stats]) => {
    if (stats.count > 6) {
      dailyCountLimitExceeded = true;
    }
    if (stats.duration > 120) {
      dailyDurationLimitExceeded = true;
    }
  });

  if (dailyCountLimitExceeded) {
    excessiveFlags.push("More than 6 breaks in a single day");
  }
  if (dailyDurationLimitExceeded) {
    excessiveFlags.push("More than 2 hours of break time in a single day");
  }

  let breakScore = 100;
  breakScore -= unapprovedCount * 20;
  if (dailyCountLimitExceeded) breakScore -= 30;
  if (dailyDurationLimitExceeded) breakScore -= 30;
  breakScore = Math.max(0, Math.min(100, breakScore));

  // 8. Feedback (5%)
  let feedbackScore = 85; // Good default
  if (user.feedbackRating === "Excellent") feedbackScore = 100;
  if (user.feedbackRating === "Good") feedbackScore = 85;
  if (user.feedbackRating === "Average") feedbackScore = 70;
  if (user.feedbackRating === "Needs Improvement") feedbackScore = 50;

  // Weighted overall calculation
  const overall = Math.round(
    attScore * 0.20 +
    taskScore * 0.30 +
    projectScore * 0.20 +
    workLogScore * 0.10 +
    meetingScore * 0.05 +
    commScore * 0.05 +
    breakScore * 0.05 +
    feedbackScore * 0.05
  );

  return {
    attendance: { score: Math.round(attScore), rate: attendanceRate, lateCount, present, absent, leave, weight: 20 },
    tasks: { score: Math.round(taskScore), completed: tasksCompleted, total: tasksTotal, overdue: overdueCount, avgCompletionHours, weight: 30 },
    projects: { score: Math.round(projectScore), completed: projectsCompleted, total: projectsTotal, led: projectsLed, weight: 20 },
    workLogs: { score: Math.round(workLogScore), count: userLogs.length, consistency: consistencyRate, avgWordCount, weight: 10 },
    meetings: { score: Math.round(meetingScore), attended: attendedCount, invited: invitedCount, excused: excusedCount, weight: 5 },
    communication: { score: Math.round(commScore), count: totalMessages, weight: 5 },
    breaks: { score: Math.round(breakScore), count: approvedBreaks.length, duration: totalBreakDuration, unapprovedCount, excessiveFlags, weight: 5 },
    feedback: { score: feedbackScore, rating: user.feedbackRating || "Good", comment: user.feedbackComment || "", weight: 5 },
    overall
  };
}

// Server Action: Update user feedback (rating & comments)
export async function updateUserFeedback(userId: number, rating: string, comment: string) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string; email?: string } | undefined;
    if (!session || !user || (user.role !== "admin" && user.role !== "super_admin")) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        feedbackRating: rating,
        feedbackComment: comment,
      },
    });

    revalidatePath("/dashboard/productivity");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to update user feedback:", error);
    return { success: false, error: "Failed to update feedback" };
  }
}

// Server Action: Retrieve details for a single intern by email
export async function getInternProductivityDetails(email: string): Promise<ProductivityBreakdown | null> {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { role?: string; email?: string } | undefined;
    if (!session || !sessionUser) return null;

    // Check authorization: must be admin/super_admin or the user requesting their own details
    const isSelf = sessionUser.email === email;
    const isAdmin = sessionUser.role === "admin" || sessionUser.role === "super_admin";
    if (!isSelf && !isAdmin) return null;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) return null;

    await deleteExpiredMeetings();

    const [tasks, projects, attendance, workLogs, meetings, chatMessages, groupMessages, breakRequests] = await Promise.all([
      prisma.task.findMany(),
      prisma.project.findMany(),
      prisma.attendance.findMany(),
      prisma.workLog.findMany(),
      prisma.meeting.findMany(),
      prisma.chatMessage.findMany(),
      prisma.groupMessage.findMany(),
      prisma.breakRequest.findMany()
    ]);

    return calculateUserProductivity(
      user,
      tasks,
      projects,
      attendance,
      workLogs,
      meetings,
      chatMessages,
      groupMessages,
      breakRequests
    );
  } catch (error) {
    console.error("Error retrieving intern productivity details:", error);
    return null;
  }
}

// Helper to retrieve all interns and their calculated productivity stats
export async function getAllInternsProductivity() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; email?: string } | undefined;
  if (!session || !user || (user.role !== "admin" && user.role !== "super_admin")) {
    throw new Error("Unauthorized");
  }

  const interns = await prisma.user.findMany({
    where: { role: "intern" }
  });

  await deleteExpiredMeetings();

  const [tasks, projects, attendance, workLogs, meetings, chatMessages, groupMessages, breakRequests] = await Promise.all([
    prisma.task.findMany(),
    prisma.project.findMany(),
    prisma.attendance.findMany(),
    prisma.workLog.findMany(),
    prisma.meeting.findMany(),
    prisma.chatMessage.findMany(),
    prisma.groupMessage.findMany(),
    prisma.breakRequest.findMany()
  ]);

  const stats = interns.map((u) => {
    const breakdown = calculateUserProductivity(
      u,
      tasks,
      projects,
      attendance,
      workLogs,
      meetings,
      chatMessages,
      groupMessages,
      breakRequests
    );

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      overall_score: breakdown.overall,
      breakdown
    };
  });

  // Sort by overall score descending
  stats.sort((a, b) => b.overall_score - a.overall_score);
  return stats;
}

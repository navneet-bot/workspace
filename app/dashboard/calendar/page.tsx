import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { CalendarView } from "@/components/features/calendar/CalendarView";
import { deleteExpiredMeetings } from "@/app/actions/meetings";

type CalendarEvent = {
  type: string;
  label: string;
  color: string;
  dateStr: string;
  extra?: {
    time?: string;
    description?: string;
    link?: string;
    descriptionText?: string;
    created_by?: string;
  };
};

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email }
  }).catch(() => null);

  if (!currentUser) {
    redirect("/login");
  }

  const role = currentUser.role;
  const isAdmin = role === "admin" || role === "super_admin";
  const isStaffOrAdmin = isAdmin || role === "tutor";

  await deleteExpiredMeetings();

  const [meetings, tasks, projects, candidates, attendance] = await Promise.all([
    prisma.meeting.findMany(),
    prisma.task.findMany({
      where: isStaffOrAdmin ? {} : { assignedTo: currentUser.email }
    }),
    prisma.project.findMany({
      where: isStaffOrAdmin ? {} : { OR: [{ createdBy: currentUser.email }, { managerEmail: currentUser.email }] }
    }),
    isAdmin ? prisma.candidate.findMany({ where: { status: "Approved" } }) : Promise.resolve([]),
    isStaffOrAdmin ? prisma.attendance.findMany() : Promise.resolve([])
  ]);

  const events: CalendarEvent[] = [];

  meetings.forEach(m => {
    if (m.date) {
      const meetingTime = m.time
        ? m.endTime
          ? `${m.time} - ${m.endTime} (${m.duration ?? 30} mins)`
          : m.time
        : undefined;

      events.push({
        type: "meeting",
        label: "📅 " + m.title,
        color: "#f59e0b",
        dateStr: m.date,
        extra: { 
          time: meetingTime,
          description: m.description, 
          link: m.meetLink 
        }
      });
    }
  });

  tasks.forEach(t => {
    if (t.deadline && t.deadline !== "TBD") {
      events.push({
        type: "task",
        label: "📋 " + t.title,
        color: t.status === "Completed" ? "#10b981" : t.priority === "High" ? "#ef4444" : "#3b82f6",
        dateStr: t.deadline
      });
    }
  });

  projects.forEach(project => {
    if (project.deadline && project.deadline !== "TBD") {
      events.push({
        type: "project",
        label: "🚀 " + project.name,
        color: "#A855F7",
        dateStr: project.deadline,
        extra: {
          description: project.description,
        }
      });
    }
  });

  candidates.forEach(c => {
    events.push({
      type: "candidate",
      label: "✅ " + c.name + " joined",
      color: "#10b981",
      dateStr: c.appliedAt.toISOString().slice(0, 10)
    });
  });

  const users = await prisma.user.findMany({ select: { email: true, name: true } }).catch(() => []);
  
  attendance.forEach(a => {
    if (a.status === "Leave" && a.date) {
      const u = users.find(x => x.email === a.email);
      const name = u ? u.name : (a.email?.split("@")[0] || "Unknown");
      const approver = a.approvedBy ? users.find(x => x.email === a.approvedBy) : null;
      events.push({
        type: "leave",
        label: "🏖 " + name + " on Leave",
        color: "#8b5cf6",
        dateStr: a.date,
        extra: {
          description: a.leaveReason || undefined,
          descriptionText: a.leaveType || undefined,
          created_by: a.approvedBy || undefined,
          time: approver?.name || a.approvedBy?.split("@")[0] || undefined,
        }
      });
    }
  });

  return (
    <div className="page-stack">
      <CalendarView events={events} />
    </div>
  );
}

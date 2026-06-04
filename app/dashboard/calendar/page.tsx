import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { CalendarView } from "@/components/features/calendar/CalendarView";
import { deleteExpiredMeetings } from "@/app/actions/meetings";

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

  await deleteExpiredMeetings();

  const [meetings, tasks, candidates, attendance] = await Promise.all([
    prisma.meeting.findMany(),
    prisma.task.findMany({
      where: isAdmin ? {} : { assignedTo: currentUser.email }
    }),
    isAdmin ? prisma.candidate.findMany({ where: { status: "Approved" } }) : Promise.resolve([]),
    isAdmin ? prisma.attendance.findMany() : Promise.resolve([])
  ]);

  const events: any[] = [];

  meetings.forEach(m => {
    if (m.date) {
      events.push({
        type: "meeting",
        label: "📅 " + m.title,
        color: "#f59e0b",
        dateStr: m.date,
        extra: { 
          time: m.endTime ? `${m.time} - ${m.endTime} (${m.duration || 30} mins)` : m.time,
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
      events.push({
        type: "leave",
        label: "🏖 " + name + " on Leave",
        color: "#8b5cf6",
        dateStr: a.date
      });
    }
  });

  return (
    <div className="page-stack">
      <CalendarView events={events} />
    </div>
  );
}

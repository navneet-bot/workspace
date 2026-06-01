import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { ChatView } from "@/components/features/chat/ChatView";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ select?: string }> | { select?: string };
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const select = resolvedParams?.select || null;

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email }
  }).catch(() => null);

  if (!currentUser) {
    redirect("/login");
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" }
  }).catch(() => []);

  const groups = await prisma.group.findMany({
    orderBy: { name: "asc" }
  }).catch(() => []);

  // Serialize group dates and convert structure
  const serializedGroups = groups.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description,
    icon: g.icon,
    members: g.members,
    createdBy: g.createdBy,
    createdAt: g.createdAt.toISOString()
  }));

  // Fetch today's attendance and work logs to determine who is active/online
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const todayAttendance = await prisma.attendance.findMany({
    where: { date: todayStr }
  }).catch(() => []);

  const todayWorkLogs = await prisma.workLog.findMany({
    where: { date: todayStr }
  }).catch(() => []);

  const activeEmailsSet = new Set<string>();

  // Admins and super admins are always active
  users.forEach(u => {
    if (u.role === "admin" || u.role === "super_admin") {
      activeEmailsSet.add(u.email);
    }
  });

  // Users marked Present today are active
  todayAttendance.forEach(a => {
    if (a.status === "Present" && a.email) {
      activeEmailsSet.add(a.email);
    }
  });

  // Users with a work log today are active
  todayWorkLogs.forEach(wl => {
    if (wl.email) {
      activeEmailsSet.add(wl.email);
    }
  });

  const activeUserEmails = Array.from(activeEmailsSet);

  return (
    <div className="h-full">
      <ChatView 
        currentUser={{ id: currentUser.id, role: currentUser.role, email: currentUser.email }} 
        users={users} 
        groups={serializedGroups}
        initialSelectedContactId={select}
        activeUserEmails={activeUserEmails}
      />
    </div>
  );
}

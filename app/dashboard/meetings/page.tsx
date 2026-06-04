import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { MeetingsList } from "@/components/features/meetings/MeetingsList";
import { deleteExpiredMeetings } from "@/app/actions/meetings";

export default async function MeetingsPage() {
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
  const permissions = currentUser.permissions || "";
  const permList = permissions.split(",").map((p: string) => p.trim());
  const canManage = role === "admin" || role === "super_admin" || role === "tutor" || permList.includes("manage_meetings");

  await deleteExpiredMeetings();

  let meetings = await prisma.meeting.findMany({
    orderBy: { createdAt: "desc" }
  }).catch(() => []);

  // Intern sees only meetings they are invited to
  if (!canManage) {
    meetings = meetings.filter(m => {
      let members = [];
      try {
        members = JSON.parse(m.members || "[]");
      } catch (e) {}
      return members.includes(currentUser.email);
    });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" }
  }).catch(() => []);

  return (
    <div className="page-stack">
      <MeetingsList 
        initialMeetings={meetings}
        allUsers={users}
        canManage={canManage}
        currentUserEmail={currentUser.email}
      />
    </div>
  );
}

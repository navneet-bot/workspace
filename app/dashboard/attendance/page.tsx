import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { AttendanceView } from "@/components/features/attendance/AttendanceView";

export default async function AttendancePage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as any).role || "intern";
  const permissions = (session.user as any).permissions || "";
  const permList = (permissions || "").split(",").map((p: string) => p.trim());
  const canAccess = role === "admin" || role === "super_admin" || role === "intern" || permList.includes("manage_attendance");
  if (!canAccess) redirect("/dashboard");

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: "asc" }
  }).catch(() => []);

  const attendance = await prisma.attendance.findMany().catch(() => []);

  return (
    <div className="page-stack">
      <AttendanceView 
        role={role} 
        permissions={permissions}
        currentUserEmail={session.user.email!}
        users={users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }))}
        attendance={attendance}
      />
    </div>
  );
}

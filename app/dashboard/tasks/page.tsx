import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { TasksTable } from "@/components/features/tasks/TasksTable";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect("/login");
  }

  const role = (session.user as any).role || "intern";
  const permissions = (session.user as any).permissions || "";
  const permList = permissions.split(",").map((p: string) => p.trim());

  const canManage = role === "admin" || role === "super_admin" || role === "tutor" || permList.includes("manage_tasks");
  if (!canManage) {
    redirect("/dashboard");
  }

  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" }
  }).catch(() => []);

  return (
    <div className="page-stack">
      <div className="table-card">
        <TasksTable initialTasks={tasks} />
      </div>
    </div>
  );
}

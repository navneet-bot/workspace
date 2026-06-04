import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { ProjectsGrid } from "@/components/features/projects/ProjectsGrid";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email || "" }
  });

  if (!currentUser) {
    redirect("/login");
  }

  const role = currentUser.role || "intern";
  const permissions = currentUser.permissions || "";
  const permList = permissions.split(",").map((p: string) => p.trim());

  const canManage = role === "admin" || role === "super_admin" || role === "tutor" || permList.includes("manage_projects");
  if (!canManage) {
    redirect("/dashboard");
  }
  const userEmail = session.user.email || "";

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" }
  }).catch(() => []);

  return (
    <div className="page-stack">
      <ProjectsGrid 
        initialProjects={projects} 
        canManage={canManage}
        currentUserEmail={userEmail}
      />
    </div>
  );
}

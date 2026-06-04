import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { TutorsTable } from "@/components/features/tutors/TutorsTable";

export default async function TutorsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect("/login");
  }

  const role = (session.user as any).role || "intern";
  const permissions = (session.user as any).permissions || "";
  const permList = permissions.split(",").map((p: string) => p.trim());

  const hasAccess = role === "admin" || role === "super_admin" || role === "tutor" || permList.includes("view_tutors");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  const tutors = await prisma.tutor.findMany({
    orderBy: { createdAt: "desc" }
  }).catch(() => []);

  const serializedTutors = tutors.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString()
  }));

  return (
    <div className="page-stack">
      <TutorsTable initialTutors={serializedTutors as any} />
    </div>
  );
}

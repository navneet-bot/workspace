import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { TutorProfileView } from "@/components/features/tutors/TutorProfileView";

export default async function TutorDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { id: rawId } = await params;
  const id = parseInt(rawId);
  if (isNaN(id)) {
    notFound();
  }

  const tutor = await prisma.tutor.findUnique({
    where: { id }
  });

  if (!tutor) {
    notFound();
  }

  const serializedTutor = {
    ...tutor,
    createdAt: tutor.createdAt.toISOString(),
    updatedAt: tutor.updatedAt.toISOString()
  };

  return (
    <div className="page-stack">
      <TutorProfileView tutor={serializedTutor as any} />
    </div>
  );
}

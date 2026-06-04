import { NextResponse as Response } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "intern";
    const isAdmin = userRole === "admin" || userRole === "super_admin";

    const tasks = await prisma.task.findMany({
      where: isAdmin ? {} : { assignedTo: session.user.email },
      orderBy: { createdAt: "desc" }
    });

    return Response.json(tasks);
  } catch (error) {
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        assignedTo: data.assignedTo,
        status: data.status || "Pending",
        priority: data.priority || "Medium",
        deadline: data.deadline,
        project: data.project,
        createdBy: session.user?.email,
      }
    });

    return Response.json(task, { status: 201 });
  } catch (error) {
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

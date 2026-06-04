"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateTaskStatus(taskId: number, newStatus: string) {
  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { 
        status: newStatus,
        completedAt: newStatus === "Completed" ? new Date() : null,
      },
    });
    revalidatePath("/dashboard/mytasks");
    revalidatePath("/dashboard/tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to update task status:", error);
    return { success: false, error: "Failed to update task status" };
  }
}

export async function updateTask(
  taskId: number,
  data: {
    title: string;
    description: string;
    assignedTo: string | null;
    priority: string;
    deadline: string;
    project: string;
    status: string;
  }
) {
  try {
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: data.title,
        description: data.description,
        assignedTo: data.assignedTo || null,
        priority: data.priority,
        deadline: data.deadline,
        project: data.project,
        status: data.status,
        completedAt: data.status === "Completed" ? new Date() : null,
      },
    });
    revalidatePath("/dashboard/mytasks");
    revalidatePath("/dashboard/tasks");
    return { success: true, task: updated };
  } catch (error) {
    console.error("Failed to update task:", error);
    return { success: false, error: "Failed to update task" };
  }
}

export async function deleteTask(taskId: number) {
  try {
    await prisma.task.delete({
      where: { id: taskId },
    });
    revalidatePath("/dashboard/mytasks");
    revalidatePath("/dashboard/tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete task:", error);
    return { success: false, error: "Failed to delete task" };
  }
}


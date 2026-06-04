"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function submitReport(data: {
  title: string;
  description: string;
  fileName: string;
  fileData: string;
  submittedBy: string;
}) {
  try {
    const report = await prisma.report.create({ data });

    // Fetch all admin and super admin users
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ["admin", "super_admin"] }
      }
    });

    const senderName = data.submittedBy ? data.submittedBy.split("@")[0] : "Intern";

    // Create notifications for all admins
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          title: `📄 New Report from ${senderName}`,
          body: `Task: ${data.title}.${data.description ? ` Details: ${data.description}` : ""}`,
          icon: "📄",
          targetEmail: admin.email
        }
      });
    }

    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/notifications");
    return { success: true, report };
  } catch (error) {
    return { success: false, error: "Failed to submit report" };
  }
}

export async function reviewReport(id: number) {
  try {
    await prisma.report.update({
      where: { id },
      data: { reviewed: true },
    });
    revalidatePath("/dashboard/reports");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to review report" };
  }
}

export async function updateReport(id: number, data: { title: string; description: string; fileName?: string; fileData?: string }) {
  try {
    const updated = await prisma.report.update({
      where: { id },
      data,
    });
    revalidatePath("/dashboard/reports");
    return { success: true, report: updated };
  } catch (error) {
    return { success: false, error: "Failed to update report" };
  }
}

export async function deleteReport(id: number) {
  try {
    await prisma.report.delete({
      where: { id },
    });
    revalidatePath("/dashboard/reports");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete report" };
  }
}


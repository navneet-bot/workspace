"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

function getProjectManagerEmails(managerEmail?: string | null) {
  if (!managerEmail) return [];
  try {
    const parsed = JSON.parse(managerEmail);
    if (Array.isArray(parsed)) {
      return parsed.filter((email): email is string => typeof email === "string" && email.trim() !== "");
    }
  } catch {
    // Older projects stored one manager email directly.
  }
  return managerEmail.trim() ? [managerEmail] : [];
}

export async function submitReport(data: {
  title: string;
  description: string;
  fileName: string;
  fileData: string;
  submittedBy: string;
  recipients?: string[];
}) {
  try {
    let targetEmails: string[] = [];

    if (data.recipients && data.recipients.length > 0) {
      // Intern selected specific recipients → send to admin + those recipients only
      const admins = await prisma.user.findMany({
        where: { role: { in: ["admin", "super_admin"] } },
        select: { email: true }
      });
      const adminEmails = admins.map(a => a.email).filter(Boolean) as string[];
      targetEmails = Array.from(new Set([...adminEmails, ...data.recipients]));
    } else {
      // No specific recipients → auto-detect project managers, or fallback to all staff
      targetEmails = [];

      if (data.submittedBy) {
        const projects = await prisma.project.findMany({
          select: { members: true, managerEmail: true }
        });
        const userProjects = projects.filter(p => {
          try {
            const members = JSON.parse(p.members || "[]");
            return Array.isArray(members) && members.includes(data.submittedBy);
          } catch {
            return false;
          }
        });
        const managerEmails = userProjects
          .flatMap(p => getProjectManagerEmails(p.managerEmail));
        if (managerEmails.length > 0) {
          targetEmails = Array.from(new Set([...targetEmails, ...managerEmails]));
        }
      }

      if (targetEmails.length === 0) {
        // Fallback: Fetch all admin, super_admin, and tutor users
        const staff = await prisma.user.findMany({
          where: { role: { in: ["admin", "super_admin", "tutor"] } },
          select: { email: true }
        });
        targetEmails = staff.map(a => a.email).filter(Boolean) as string[];
      }
    }

    const { recipients, ...reportData } = data;
    const report = await prisma.report.create({ 
      data: {
        ...reportData,
        submittedTo: JSON.stringify(targetEmails)
      } 
    });

    const senderName = data.submittedBy ? data.submittedBy.split("@")[0] : "Intern";

    // Create notifications for selected users
    for (const email of targetEmails) {
      await prisma.notification.create({
        data: {
          title: `📄 New Report from ${senderName}`,
          body: `Task: ${data.title}.${data.description ? ` Details: ${data.description}` : ""}`,
          icon: "📄",
          targetEmail: email
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

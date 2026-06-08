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

export async function markAttendance(
  email: string,
  status: string,
  date: string,
  leaveType?: string,
  leaveReason?: string,
  approvedBy?: string
) {
  try {
    const existing = await prisma.attendance.findFirst({
      where: {
        email,
        date,
      },
    });

    if (existing) {
      // Check if this was a pending leave approval or rejection
      if (existing.status === "Leave Requested") {
        if (status === "Leave") {
          await prisma.notification.create({
            data: {
              title: "✅ Leave Approved",
              body: `Your leave request for ${date} has been approved.`,
              icon: "🏖",
              targetEmail: email,
            },
          });
        } else if (status === "Absent") {
          await prisma.notification.create({
            data: {
              title: "❌ Leave Rejected",
              body: `Your leave request for ${date} was rejected.`,
              icon: "❌",
              targetEmail: email,
            },
          });
        }
      }

      const updateData: any = { status };
      if (leaveType !== undefined) updateData.leaveType = leaveType;
      if (leaveReason !== undefined) updateData.leaveReason = leaveReason;
      if (approvedBy !== undefined && status === "Leave") {
        updateData.approvedBy = approvedBy;
        updateData.approvedAt = new Date();
      }

      await prisma.attendance.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      await prisma.attendance.create({
        data: {
          email,
          status,
          date,
          leaveType: leaveType || null,
          leaveReason: leaveReason || null,
        },
      });
    }

    if (status === "Leave Requested") {
      // Find the user's name
      const user = await prisma.user.findUnique({
        where: { email },
        select: { name: true }
      });
      const userName = user?.name || email.split("@")[0];

      // Find projects where user is a member
      const projects = await prisma.project.findMany();
      const userProjects = projects.filter(p => {
        try {
          const members = JSON.parse(p.members || "[]");
          return Array.isArray(members) && members.includes(email);
        } catch {
          return false;
        }
      });
      
      const managerEmails = userProjects
        .flatMap(p => getProjectManagerEmails(p.managerEmail));

      let targetEmails = Array.from(new Set(managerEmails));
      if (targetEmails.length === 0) {
        // Fallback: Notify all admins, super_admins, and tutors
        const admins = await prisma.user.findMany({
          where: {
            role: { in: ["admin", "super_admin", "tutor"] }
          },
          select: { email: true }
        });
        targetEmails = admins.map(a => a.email).filter(Boolean);
      }

      // Send notifications
      for (const tEmail of targetEmails) {
        await prisma.notification.create({
          data: {
            title: "🏖 New Leave Request",
            body: `${userName} requested leave for ${date}.${leaveType ? ` Type: ${leaveType}.` : ""}${leaveReason ? ` Reason: ${leaveReason}` : ""}`,
            icon: "🏖",
            targetEmail: tEmail
          }
        });
      }
    }

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/productivity");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error marking attendance:", error);
    return { success: false, error: error.message || "Failed to mark attendance" };
  }
}

export async function getPendingLeaves() {
  try {
    const pending = await prisma.attendance.findMany({
      where: { status: "Leave Requested" },
      orderBy: [{ email: "asc" }, { date: "asc" }]
    });
    
    const emails = pending.map(p => p.email).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true, name: true }
    });
    
    const userMap = new Map(users.map(u => [u.email, u.name]));
    
    // Group consecutive dates by (email, leaveType, leaveReason)
    const groups: {
      email: string;
      name: string;
      startDate: string;
      endDate: string;
      dayCount: number;
      leaveType: string | null;
      leaveReason: string | null;
      ids: number[];
      dates: string[];
    }[] = [];

    for (const p of pending) {
      const email = p.email || "";
      const key = `${email}|${p.leaveType || ""}|${p.leaveReason || ""}`;
      const lastGroup = groups[groups.length - 1];

      if (lastGroup) {
        const lastKey = `${lastGroup.email}|${lastGroup.leaveType || ""}|${lastGroup.leaveReason || ""}`;
        const prevDate = new Date(lastGroup.endDate);
        const curDate = new Date(p.date || "");
        const diffDays = (curDate.getTime() - prevDate.getTime()) / 86400000;

        if (key === lastKey && diffDays === 1) {
          lastGroup.endDate = p.date!;
          lastGroup.dayCount++;
          lastGroup.ids.push(p.id);
          lastGroup.dates.push(p.date!);
          continue;
        }
      }

      groups.push({
        email,
        name: userMap.get(email) || email.split("@")[0] || "Unknown",
        startDate: p.date!,
        endDate: p.date!,
        dayCount: 1,
        leaveType: p.leaveType,
        leaveReason: p.leaveReason,
        ids: [p.id],
        dates: [p.date!],
      });
    }
    
    return {
      success: true,
      leaves: groups
    };
  } catch (error: any) {
    console.error("Error fetching pending leaves:", error);
    return { success: false, error: error.message || "Failed to fetch pending leaves" };
  }
}

export async function batchApproveLeave(email: string, dates: string[], approvedBy?: string) {
  try {
    await prisma.attendance.updateMany({
      where: {
        email,
        date: { in: dates },
        status: "Leave Requested",
      },
      data: { status: "Leave", approvedBy: approvedBy || null, approvedAt: new Date() },
    });

    await prisma.notification.create({
      data: {
        title: "✅ Leave Approved",
        body: `Your leave request for ${dates.length} day(s) (${dates[0]} to ${dates[dates.length - 1]}) has been approved.`,
        icon: "🏖",
        targetEmail: email,
      },
    });

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/productivity");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error batch approving leave:", error);
    return { success: false, error: error.message || "Failed to approve leave" };
  }
}

export async function batchRejectLeave(email: string, dates: string[]) {
  try {
    await prisma.attendance.updateMany({
      where: {
        email,
        date: { in: dates },
        status: "Leave Requested",
      },
      data: { status: "Absent" },
    });

    await prisma.notification.create({
      data: {
        title: "❌ Leave Rejected",
        body: `Your leave request for ${dates.length} day(s) (${dates[0]} to ${dates[dates.length - 1]}) was rejected.`,
        icon: "❌",
        targetEmail: email,
      },
    });

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/productivity");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error batch rejecting leave:", error);
    return { success: false, error: error.message || "Failed to reject leave" };
  }
}

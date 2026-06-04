"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function deleteExpiredMeetings() {
  try {
    const now = new Date();
    const meetings = await prisma.meeting.findMany();
    const expiredIds: number[] = [];

    for (const m of meetings) {
      if (!m.date) continue;
      
      const startT = m.time || "00:00";
      const endT = m.endTime || addMinutesToTime(startT, m.duration || 30);
      
      const [year, month, day] = m.date.split("-").map(Number);
      const [hours, minutes] = endT.split(":").map(Number);
      
      const pad = (n: number) => String(n).padStart(2, "0");
      const isoStr = `${pad(year)}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+05:30`;
      const meetingEndDateTime = new Date(isoStr);
      
      if (now > meetingEndDateTime) {
        expiredIds.push(m.id);
      }
    }

    if (expiredIds.length > 0) {
      for (const id of expiredIds) {
        const meeting = meetings.find(m => m.id === id);
        if (meeting) {
          let memberEmails: string[] = [];
          try {
            memberEmails = JSON.parse(meeting.members || "[]");
          } catch {}
          await prisma.notification.deleteMany({
            where: {
              title: `📅 New Meeting: ${meeting.title}`,
              targetEmail: { in: memberEmails },
              icon: "📅"
            }
          });
        }
      }

      await prisma.meeting.deleteMany({
        where: { id: { in: expiredIds } }
      });
      console.log(`Deleted ${expiredIds.length} expired meetings.`);
    }
  } catch (error) {
    console.error("Failed to delete expired meetings:", error);
  }
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  if (!timeStr) return "00:00";
  const [h, m] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m + minutes, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export async function createMeeting(data: {
  title: string;
  description: string;
  date: string;
  time: string;
  endTime?: string;
  duration?: number;
  meetLink: string;
  members: string;
  createdBy: string;
}) {
  try {
    const meeting = await prisma.meeting.create({
      data: {
        title: data.title,
        description: data.description,
        date: data.date,
        time: data.time,
        endTime: data.endTime,
        duration: data.duration,
        meetLink: data.meetLink,
        members: data.members,
        createdBy: data.createdBy,
      }
    });
    
    // Notify all invited members except the creator
    let memberEmails: string[] = [];
    try {
      memberEmails = JSON.parse(data.members || "[]");
    } catch {}
 
    const creatorName = data.createdBy ? data.createdBy.split("@")[0] : "Admin";
    const timeRangeStr = data.endTime 
      ? `from ${data.time} to ${data.endTime} (${data.duration || 30} mins)`
      : `at ${data.time}`;
 
    for (const email of memberEmails) {
      if (email !== data.createdBy) {
        await prisma.notification.create({
          data: {
            title: `📅 New Meeting: ${data.title}`,
            body: `Scheduled by ${creatorName} for ${data.date} ${timeRangeStr}.${data.description ? ` Details: ${data.description}` : ""}`,
            icon: "📅",
            targetEmail: email
          }
        });
      }
    }
 
    revalidatePath("/dashboard/meetings");
    revalidatePath("/dashboard/notifications");
    return { success: true, meeting };
  } catch (error) {
    return { success: false, error: "Failed to create meeting" };
  }
}

export async function deleteMeeting(id: number) {
  try {
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (meeting) {
      let memberEmails: string[] = [];
      try {
        memberEmails = JSON.parse(meeting.members || "[]");
      } catch {}

      // Delete corresponding notifications
      await prisma.notification.deleteMany({
        where: {
          title: `📅 New Meeting: ${meeting.title}`,
          targetEmail: { in: memberEmails },
          icon: "📅"
        }
      });

      await prisma.meeting.delete({ where: { id } });
    }
    revalidatePath("/dashboard/meetings");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete meeting" };
  }
}

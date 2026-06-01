import { NextResponse as Response } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role || "intern";
    if (role !== "admin" && role !== "super_admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date"); // YYYY-MM-DD
    if (!dateStr) {
      return Response.json({ error: "Date is required" }, { status: 400 });
    }

    // Get all users who are not admins/super_admins
    const users = await prisma.user.findMany({
      where: {
        role: { notIn: ["admin", "super_admin"] }
      },
      select: {
        id: true,
        name: true,
        email: true
      },
      orderBy: {
        name: "asc"
      }
    });

    // Get attendance records for this date
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        date: dateStr
      }
    });

    // Get work logs for this date to extract loginTime (checkIn)
    const workLogs = await prisma.workLog.findMany({
      where: {
        date: dateStr
      }
    });

    // Build map of email -> check-in time (from work logs)
    const workLogMap = new Map<string, string>();
    workLogs.forEach((wl) => {
      if (wl.email && wl.loginTime) {
        let checkInTime = "—";
        try {
          const d = new Date(wl.loginTime);
          if (!isNaN(d.getTime())) {
            // Format to HH:MM (24-hour)
            const hours = String(d.getHours()).padStart(2, "0");
            const mins = String(d.getMinutes()).padStart(2, "0");
            checkInTime = `${hours}:${mins}`;
          } else {
            // Fallback: If it's already a time string or other format, extract time
            const matches = wl.loginTime.match(/\d{2}:\d{2}/);
            checkInTime = matches ? matches[0] : wl.loginTime;
          }
        } catch (e) {
          checkInTime = wl.loginTime;
        }
        workLogMap.set(wl.email, checkInTime);
      }
    });

    // Build map of email -> attendance status
    const attendanceMap = new Map<string, string>();
    attendanceRecords.forEach((ar) => {
      if (ar.email) {
        attendanceMap.set(ar.email, ar.status);
      }
    });

    // Construct response matching the requested schema
    const responseData = users.map((u) => {
      const email = u.email;
      const status = attendanceMap.get(email) || "Absent";
      const checkIn = status.toLowerCase() === "present" ? (workLogMap.get(email) || "—") : "—";
      return {
        userId: u.id,
        email: u.email,
        name: u.name,
        status: status.toLowerCase(),
        checkIn: checkIn
      };
    });

    return Response.json(responseData);
  } catch (error: any) {
    return Response.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

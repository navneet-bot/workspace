"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendCustomEmail } from "@/lib/email/resend";
import bcrypt from "bcryptjs";

export async function createTutor(data: any) {
  try {
    const status = data.status || "Applied";
    const history = JSON.stringify([
      {
        status,
        timestamp: new Date().toISOString(),
        notes: "Tutor profile created manually"
      }
    ]);

    // Generate Unique JobJockey ID for Tutor
    const base = data.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9.]/g, "");
    
    let jobjockeyId = `${base}@jobjockey.in`;
    let suffix = "";
    let counter = 1;
    while (true) {
      const candidateId = `${base}${suffix}@jobjockey.in`;
      const existingJj = await prisma.user.findFirst({
        where: { jobjockeyId: candidateId }
      });
      const existingTutor = await prisma.tutor.findFirst({
        where: { jobjockeyId: candidateId }
      });
      if (!existingJj && !existingTutor) {
        jobjockeyId = candidateId;
        break;
      }
      suffix = String(counter++);
    }

    const tutor = await prisma.tutor.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || "",
        gender: data.gender || "",
        dob: data.dob || "",
        location: data.location || "",
        profilePhoto: data.profilePhoto || "",
        qualification: data.qualification || "",
        university: data.university || "",
        degree: data.degree || "",
        specialization: data.specialization || "",
        gradYear: data.gradYear || "",
        subject: data.subject || "",
        experience: data.experience || "",
        mode: data.mode || "Online",
        occupation: data.occupation || "",
        prevInst: data.prevInst || "",
        certifications: data.certifications || "",
        portfolio: data.portfolio || "",
        linkedinUrl: data.linkedinUrl || "",
        resumeUrl: data.resumeUrl || "",
        status,
        interviewNotes: data.interviewNotes || "",
        statusHistory: history,
        jobjockeyId: jobjockeyId
      }
    });

    revalidatePath("/dashboard/tutors");
    return { success: true, tutor };
  } catch (error: any) {
    console.error("Error creating tutor:", error);
    return { success: false, error: error.message };
  }
}

export async function updateTutorDetails(id: number, data: any) {
  try {
    const existing = await prisma.tutor.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Tutor not found" };

    // If status changed in edit details, handle it with history
    let newHistory = existing.statusHistory;
    if (data.status && data.status !== existing.status) {
      let historyList = [];
      try {
        historyList = JSON.parse(existing.statusHistory || "[]");
      } catch (e) {}
      historyList.push({
        status: data.status,
        timestamp: new Date().toISOString(),
        notes: "Details updated"
      });
      newHistory = JSON.stringify(historyList);
    }

    const updated = await prisma.tutor.update({
      where: { id },
      data: {
        ...data,
        statusHistory: newHistory
      }
    });

    revalidatePath("/dashboard/tutors");
    revalidatePath(`/dashboard/tutors/${id}`);
    return { success: true, tutor: updated };
  } catch (error: any) {
    console.error("Error updating tutor details:", error);
    return { success: false, error: error.message };
  }
}

export async function updateTutorStatus(id: number, status: string, notes?: string) {
  try {
    const existing = await prisma.tutor.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Tutor not found" };

    let historyList = [];
    try {
      historyList = JSON.parse(existing.statusHistory || "[]");
    } catch (e) {}

    historyList.push({
      status,
      timestamp: new Date().toISOString(),
      notes: notes || `Status updated to ${status}`
    });

    // If status is Onboarded, create user account & send credentials
    if (status === "Onboarded") {
      if (!existing.email) {
        return { success: false, error: "Tutor email is required for onboarding" };
      }
      const tutorEmail = existing.email;

      // Ensure email uniqueness in User model
      const existingUser = await prisma.user.findUnique({ where: { email: tutorEmail } });
      let generatedPassword = "";
      let hashedPassword = "";
      if (!existingUser) {
        // Generate Unique Password (FIRST 3 LETTERS + RANDOM 3 DIGITS)
        const letters = existing.name.replace(/[^a-zA-Z]/g, '');
        const prefix = (letters.length >= 3 ? letters.slice(0, 3) : letters.padEnd(3, 'X')).toUpperCase();
        const digits = Math.floor(100 + Math.random() * 900); // 100 to 999
        generatedPassword = `${prefix}${digits}`;
        hashedPassword = await bcrypt.hash(generatedPassword, 10);
      }

      // Generate Unique JobJockey ID for Tutor User if not already set
      let jobjockeyId = existing.jobjockeyId;
      if (!existingUser && !jobjockeyId) {
        const base = existing.name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ".")
          .replace(/[^a-z0-9.]/g, "");
        
        jobjockeyId = `${base}@jobjockey.in`;
        let suffix = "";
        let counter = 1;
        while (true) {
          const candidateId = `${base}${suffix}@jobjockey.in`;
          const existingJj = await prisma.user.findFirst({
            where: { jobjockeyId: candidateId }
          });
          const existingTutor = await prisma.tutor.findFirst({
            where: { jobjockeyId: candidateId, NOT: { id: existing.id } }
          });
          if (!existingJj && !existingTutor) {
            jobjockeyId = candidateId;
            break;
          }
          suffix = String(counter++);
        }
      }

      await prisma.$transaction(async (tx) => {
        if (!existingUser) {
          // Create User with role "tutor"
          await tx.user.create({
            data: {
              name: existing.name,
              email: tutorEmail,
              password: hashedPassword,
              role: "tutor",
              permissions: "",
              mustChangePassword: true,
              jobjockeyId: jobjockeyId,
            }
          });
        }

        // Update Tutor status
        await tx.tutor.update({
          where: { id },
          data: {
            status,
            jobjockeyId: jobjockeyId,
            interviewNotes: notes !== undefined ? notes : existing.interviewNotes,
            statusHistory: JSON.stringify(historyList)
          }
        });
      });

      // Dispatch onboarding email with credentials if user was newly created
      if (!existingUser && generatedPassword) {
        try {
          const { sendInvitationEmail } = await import("@/lib/email/resend");
          await sendInvitationEmail(tutorEmail, existing.name, "tutor", jobjockeyId || undefined, generatedPassword);
        } catch (mailError) {
          console.error("Resend welcome email failed to send for tutor:", mailError);
        }
      } else if (existing.email) {
        // Email standard custom onboarding notification if user already exists
        try {
          await sendCustomEmail(
            tutorEmail,
            "🤝 Tutor Onboarding Invitation - Job Jockey",
            `Dear ${existing.name},\n\nWelcome to our team! We have marked you as successfully onboarded. Please check in with your administrator to complete any remaining documentation.\n\nBest Regards,\nJob Jockey Team`,
            existing.name
          );
        } catch (mailErr) {
          console.error("Failed to send tutor custom onboard email:", mailErr);
        }
      }
    } else {
      // Just update status if not Onboarded
      await prisma.tutor.update({
        where: { id },
        data: {
          status,
          interviewNotes: notes !== undefined ? notes : existing.interviewNotes,
          statusHistory: JSON.stringify(historyList)
        }
      });
    }

    const updated = await prisma.tutor.findUnique({ where: { id } });

    // In-app Notification for Admins/Super Admins
    try {
      await prisma.notification.create({
        data: {
          title: `👨‍🏫 Tutor Status: ${status}`,
          body: `${existing.name}'s status changed to ${status}`,
          icon: "👨‍🏫",
          targetEmail: "ALL" // Alert all admins
        }
      });
      revalidatePath("/dashboard/notifications");
    } catch (notifErr) {
      console.error("Failed to create tutor in-app notification:", notifErr);
    }

    revalidatePath("/dashboard/tutors");
    revalidatePath(`/dashboard/tutors/${id}`);
    return { success: true, tutor: updated };
  } catch (error: any) {
    console.error("Error updating tutor status:", error);
    return { success: false, error: error.message };
  }
}

export async function bulkUpdateTutorStatus(ids: number[], status: string) {
  try {
    for (const id of ids) {
      await updateTutorStatus(id, status, `Bulk status update to ${status}`);
    }
    revalidatePath("/dashboard/tutors");
    return { success: true };
  } catch (error: any) {
    console.error("Error bulk updating tutor status:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteTutors(ids: number[]) {
  try {
    await prisma.tutor.deleteMany({
      where: { id: { in: ids } }
    });
    revalidatePath("/dashboard/tutors");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting tutors:", error);
    return { success: false, error: error.message };
  }
}

export async function bulkImportTutors(tutors: any[]) {
  let imported = 0;
  let dupes = 0;
  let errors = 0;

  for (const t of tutors) {
    try {
      if (t.email) {
        const existing = await prisma.tutor.findFirst({
          where: { email: t.email }
        });
        if (existing) {
          dupes++;
          continue;
        }
      }

      const status = t.status || "Applied";
      const history = JSON.stringify([
        {
          status,
          timestamp: new Date().toISOString(),
          notes: "Imported via CSV file"
        }
      ]);

      await prisma.tutor.create({
        data: {
          name: t.name,
          email: t.email || null,
          phone: t.phone || "",
          gender: t.gender || "",
          dob: t.dob || "",
          location: t.location || "",
          profilePhoto: t.profilePhoto || "",
          qualification: t.qualification || "",
          university: t.university || "",
          degree: t.degree || "",
          specialization: t.specialization || "",
          gradYear: t.gradYear || "",
          subject: t.subject || "",
          experience: t.experience || "",
          mode: t.mode || "Online",
          occupation: t.occupation || "",
          prevInst: t.prevInst || "",
          certifications: t.certifications || "",
          portfolio: t.portfolio || "",
          linkedinUrl: t.linkedinUrl || "",
          resumeUrl: t.resumeUrl || "",
          status,
          interviewNotes: "",
          statusHistory: history
        }
      });
      imported++;
    } catch (e) {
      console.error("Error importing tutor:", e);
      errors++;
    }
  }

  revalidatePath("/dashboard/tutors");
  return {
    imported,
    dupes,
    errors
  };
}

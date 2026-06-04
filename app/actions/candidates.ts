"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

export async function bulkImportCandidates(candidates: any[]) {
  let imported = 0;
  let dupes = 0;
  let errors = 0;

  for (const c of candidates) {
    try {
      if (c.email) {
        const existing = await prisma.candidate.findFirst({
          where: { email: c.email }
        });
        
        if (existing) {
          dupes++;
          continue;
        }
      }

      await prisma.candidate.create({
        data: {
          name: c.name,
          email: c.email || null,
          phone: c.phone || "",
          skill: c.skill || "",
          resume: c.resume || "",
          resumeLink: c.resumeLink || "",
          status: c.status || "Pending",
          state: c.state || "",
          college: c.college || "",
          eduDomain: c.eduDomain || "",
          duration: c.duration || "",
        }
      });
      imported++;
    } catch (e) {
      console.error("Error importing candidate:", e);
      errors++;
    }
  }

  revalidatePath("/dashboard/candidates");
  
  return {
    imported,
    dupes,
    errors
  };
}

export async function fetchGoogleSheetCsv(sheetId: string) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch sheet: ${res.statusText}. Make sure it is public!`);
    }
    const csvText = await res.text();
    return { success: true, data: csvText };
  } catch (error: any) {
    console.error("Error fetching sheet:", error);
    return { success: false, error: error.message };
  }
}

export async function updateCandidateStatus(id: number, status: string) {
  try {
    const candidate = await prisma.candidate.findUnique({ where: { id } });
    if (!candidate) return { success: false, error: "Candidate not found" };

    let resumeData = candidate.resume || "";

    if (status === "Approved" && !resumeData.startsWith("LOGIN:")) {
      if (!candidate.email) {
        return { success: false, error: "Candidate email is required for approval" };
      }
      const jjEmail = candidate.email;

      // Ensure email uniqueness in User model
      const existingUser = await prisma.user.findUnique({ where: { email: jjEmail } });
      if (existingUser) {
        return { success: false, error: `A user account with the email ${jjEmail} already exists.` };
      }

      // Generate Unique Password (FIRST 3 LETTERS + RANDOM 3 DIGITS)
      const letters = candidate.name.replace(/[^a-zA-Z]/g, '');
      const prefix = (letters.length >= 3 ? letters.slice(0, 3) : letters.padEnd(3, 'X')).toUpperCase();
      const digits = Math.floor(100 + Math.random() * 900); // 100 to 999
      const generatedPassword = `${prefix}${digits}`;
      
      // Generate Unique JobJockey ID
      const base = candidate.name
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
        if (!existingJj) {
          jobjockeyId = candidateId;
          break;
        }
        suffix = String(counter++);
      }

      const hashedPassword = await bcrypt.hash(generatedPassword, 10);
      resumeData = `LOGIN:${jjEmail}|PASS:${generatedPassword}`;

      // Run Database operations in a transaction
      await prisma.$transaction(async (tx) => {
        // Create User
        await tx.user.create({
          data: {
            name: candidate.name,
            email: jjEmail,
            password: hashedPassword,
            role: "intern",
            permissions: "",
            mustChangePassword: true,
            jobjockeyId: jobjockeyId,
          }
        });

        // Update Candidate
        await tx.candidate.update({
          where: { id },
          data: { 
            status,
            resume: resumeData
          }
        });
      });

      // Dispatch onboarding email using Resend via the centralized service layer
      if (candidate.email) {
        try {
          const { sendInvitationEmail } = await import("@/lib/email/resend");
          await sendInvitationEmail(candidate.email, candidate.name, "intern", jobjockeyId, generatedPassword);
        } catch (mailError) {
          console.error("Resend welcome email failed to send:", mailError);
        }
      }
    } else {
      // Just update status if not approving for the first time
      await prisma.candidate.update({
        where: { id },
        data: { status }
      });
    }

    revalidatePath("/dashboard/candidates");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bulkUpdateCandidateStatus(ids: number[], status: string) {
  try {
    for (const id of ids) {
      await updateCandidateStatus(id, status);
    }
    revalidatePath("/dashboard/candidates");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCandidateCompletely(id: number) {
  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return { success: false, error: "Candidate not found" };

  const txOps = [];
  
  // 1. Delete Candidate
  txOps.push(prisma.candidate.delete({ where: { id } }));

  // 2. Identify and Delete User and associated data
  if (candidate.resume && candidate.resume.startsWith("LOGIN:")) {
    const parts = candidate.resume.replace("LOGIN:", "").split("|PASS:");
    const jjEmail = parts[0];

    const user = await prisma.user.findUnique({ where: { email: jjEmail } });
    if (user) {
      txOps.push(prisma.user.delete({ where: { id: user.id } }));
      txOps.push(prisma.task.deleteMany({ where: { OR: [{ assignedTo: jjEmail }, { createdBy: jjEmail }] } }));
      txOps.push(prisma.attendance.deleteMany({ where: { email: jjEmail } }));
      txOps.push(prisma.workLog.deleteMany({ where: { email: jjEmail } }));
      txOps.push(prisma.report.deleteMany({ where: { submittedBy: jjEmail } }));
      txOps.push(prisma.chatMessage.deleteMany({ where: { OR: [{ senderId: user.id }, { receiverId: user.id }] } }));
      txOps.push(prisma.groupMessage.deleteMany({ where: { sender: jjEmail } }));
      txOps.push(prisma.project.deleteMany({ where: { createdBy: jjEmail } }));
      txOps.push(prisma.meeting.deleteMany({ where: { createdBy: jjEmail } }));
      txOps.push(prisma.group.deleteMany({ where: { createdBy: jjEmail } }));
      
      // Wait, let's also delete notifications targeted at them
      txOps.push(prisma.notification.deleteMany({ where: { targetEmail: jjEmail } }));
      
      console.log(`[Activity Log] Deleted candidate ${candidate.name} and user ${jjEmail} at ${new Date().toISOString()}`);
    } else {
      console.log(`[Activity Log] Deleted candidate ${candidate.name} (no user found) at ${new Date().toISOString()}`);
    }
  } else {
    console.log(`[Activity Log] Deleted candidate ${candidate.name} (never approved) at ${new Date().toISOString()}`);
  }

  // Execute atomic deletion
  await prisma.$transaction(txOps);
  return { success: true };
}

export async function deleteCandidates(ids: number[]) {
  try {
    for (const id of ids) {
      const res = await deleteCandidateCompletely(id);
      if (!res.success) throw new Error(res.error);
    }
    revalidatePath("/dashboard/candidates");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCandidateDetails(id: number, data: any) {
  try {
    await prisma.candidate.update({
      where: { id },
      data
    });
    revalidatePath("/dashboard/candidates");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function revokeCandidateCredentials(id: number) {
  try {
    const candidate = await prisma.candidate.findUnique({ where: { id } });
    if (!candidate) return { success: false, error: "Candidate not found" };

    if (candidate.resume && candidate.resume.startsWith("LOGIN:")) {
      const parts = candidate.resume.replace("LOGIN:", "").split("|PASS:");
      const jjEmail = parts[0];

      // Delete the intern user
      const user = await prisma.user.findUnique({ where: { email: jjEmail } });
      if (user && user.role === "intern") {
        await prisma.user.delete({ where: { id: user.id } });
      }
    }

    // Set status to Rejected and clear resume field, matching original EOD logic
    await prisma.candidate.update({
      where: { id },
      data: { 
        resume: "",
        status: "Rejected"
      }
    });

    revalidatePath("/dashboard/candidates");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCandidate(data: any) {
  try {
    const candidate = await prisma.candidate.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || "",
        skill: data.skill || "",
        state: data.state || "",
        college: data.college || "",
        eduDomain: data.eduDomain || "",
        duration: data.duration || "",
        resumeLink: data.resumeLink || "",
        status: "Pending"
      }
    });
    revalidatePath("/dashboard/candidates");
    return { success: true, candidate };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

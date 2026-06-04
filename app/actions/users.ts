"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function promoteUser(id: number) {
  try {
    await prisma.user.update({
      where: { id },
      data: { role: "super_admin" },
    });
    revalidatePath("/dashboard/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to promote user" };
  }
}

export async function demoteUser(id: number) {
  try {
    await prisma.user.update({
      where: { id },
      data: { role: "intern", permissions: "" },
    });
    revalidatePath("/dashboard/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to demote user" };
  }
}

export async function updateUserRole(id: number, role: string) {
  try {
    await prisma.user.update({
      where: { id },
      data: {
        role,
      },
    });
    revalidatePath("/dashboard/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update role" };
  }
}

export async function updateUserPermissions(id: number, permissions: string) {
  try {
    await prisma.user.update({
      where: { id },
      data: { permissions },
    });
    revalidatePath("/dashboard/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update permissions" };
  }
}

export async function deleteUser(id: number) {
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/dashboard/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete user" };
  }
}

export async function createUser(data: {
  name: string;
  email: string;
  role: string;
  password?: string;
}) {
  try {
    if (!data.name.trim()) return { success: false, error: "Name is required" };
    if (!data.email.trim()) return { success: false, error: "Email is required" };

    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (existing) {
      return { success: false, error: "A user account with this email already exists." };
    }

    let rawPassword = data.password;
    if (!rawPassword || !rawPassword.trim()) {
      const letters = data.name.replace(/[^a-zA-Z]/g, '');
      const prefix = (letters.length >= 3 ? letters.slice(0, 3) : letters.padEnd(3, 'X')).toUpperCase();
      const digits = Math.floor(100 + Math.random() * 900);
      rawPassword = `${prefix}${digits}`;
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // Generate unique jobjockeyId
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
      if (!existingJj) {
        jobjockeyId = candidateId;
        break;
      }
      suffix = String(counter++);
    }

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        permissions: "",
        mustChangePassword: true,
        jobjockeyId: jobjockeyId,
      }
    });

    try {
      const { sendInvitationEmail } = await import("@/lib/email/resend");
      await sendInvitationEmail(data.email, data.name, data.role, jobjockeyId, rawPassword);
    } catch (mailError) {
      console.error("Welcome email failed to send for created user:", mailError);
    }

    revalidatePath("/dashboard/users");
    return { 
      success: true, 
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        jobjockeyId: newUser.jobjockeyId,
      }
    };
  } catch (error: any) {
    console.error("Failed to create user:", error);
    return { success: false, error: error.message || "Failed to create user" };
  }
}


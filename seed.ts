import prisma from "./lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const passwordHash = await bcrypt.hash("123", 10);

  // Upsert Admin
  const admin = await prisma.user.upsert({
    where: { email: "navneet@jobjockey.in" },
    update: {
      password: passwordHash,
      role: "admin",
      name: "Navneet (Admin)",
    },
    create: {
      email: "navneet@jobjockey.in",
      password: passwordHash,
      role: "admin",
      name: "Navneet (Admin)",
    },
  });
  console.log("Upserted admin user:", admin.email);

  // Upsert Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@jobjockey.in" },
    update: {
      password: passwordHash,
      role: "super_admin",
      name: "Navneet (Super Admin)",
    },
    create: {
      email: "superadmin@jobjockey.in",
      password: passwordHash,
      role: "super_admin",
      name: "Navneet (Super Admin)",
    },
  });
  console.log("Upserted super admin user:", superAdmin.email);

  // Seed 5 Candidates (Interns)
  const candidates = [
    { name: "Rahul Sharma", email: "rahul@test.com", phone: "9999900001", skill: "React, JS", state: "Maharashtra", college: "VIT", eduDomain: "CSE", duration: "3 months" },
    { name: "Sneha Patel", email: "sneha@test.com", phone: "9999900002", skill: "Python, Django", state: "Gujarat", college: "Nirma Uni", eduDomain: "IT", duration: "6 months" },
    { name: "Arjun Singh", email: "arjun@test.com", phone: "9999900003", skill: "Java, Spring", state: "Delhi", college: "DTU", eduDomain: "CSE", duration: "3 months" },
    { name: "Priya Gupta", email: "priya@test.com", phone: "9999900004", skill: "UI/UX, Figma", state: "Karnataka", college: "PES", eduDomain: "Design", duration: "6 months" },
    { name: "Vikram Reddy", email: "vikram@test.com", phone: "9999900005", skill: "Node, AWS", state: "Telangana", college: "IIIT", eduDomain: "CSE", duration: "3 months" },
  ];

  for (const c of candidates) {
    const candidate = await prisma.candidate.upsert({
      where: { id: 0 },
      update: {},
      create: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        skill: c.skill,
        status: "Approved",
        state: c.state,
        college: c.college,
        eduDomain: c.eduDomain,
        duration: c.duration,
        appliedAt: new Date(),
      },
    });

    // Create corresponding user with password 123
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: { password: passwordHash },
      create: {
        name: c.name,
        email: c.email,
        password: passwordHash,
        role: "intern",
      },
    });

    console.log("Created candidate & user:", candidate.name, user.email);
  }

  // Seed 3 Tutors
  const tutors = [
    {
      name: "Anjali Mehta",
      email: "anjali@test.com",
      phone: "8888800001",
      gender: "Female",
      qualification: "M.Sc",
      university: "DU",
      subject: "Mathematics",
      experience: "5 years",
      mode: "Online",
      jobjockeyId: "TUT-1001",
    },
    {
      name: "Ravi Patel",
      email: "ravi@test.com",
      phone: "8888800002",
      gender: "Male",
      qualification: "PhD",
      university: "IIT Bombay",
      subject: "Physics",
      experience: "8 years",
      mode: "Hybrid",
      jobjockeyId: "TUT-1002",
    },
    {
      name: "Deepa Krishnan",
      email: "deepa@test.com",
      phone: "8888800003",
      gender: "Female",
      qualification: "M.A",
      university: "JNU",
      subject: "English",
      experience: "4 years",
      mode: "Online",
      jobjockeyId: "TUT-1003",
    },
  ];

  for (const t of tutors) {
    const tutor = await prisma.tutor.upsert({
      where: { jobjockeyId: t.jobjockeyId },
      update: {},
      create: {
        name: t.name,
        email: t.email,
        phone: t.phone,
        gender: t.gender,
        qualification: t.qualification,
        university: t.university,
        subject: t.subject,
        experience: t.experience,
        mode: t.mode,
        status: "Onboarded",
        jobjockeyId: t.jobjockeyId,
        statusHistory: JSON.stringify([
          { status: "Applied", timestamp: new Date().toISOString() },
          { status: "Onboarded", timestamp: new Date().toISOString() },
        ]),
      },
    });

    // Create corresponding user with password 123
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: { password: passwordHash },
      create: {
        name: t.name,
        email: t.email,
        password: passwordHash,
        role: "intern",
      },
    });

    console.log("Created tutor & user:", tutor.name, user.email);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

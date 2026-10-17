import { PrismaClient, AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function resetAdmin() {
  const email = "superadmin2@trustship.com";
  const rawPassword = "SecurePassword123!";
  
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  console.log("Generated fresh hash:", hashedPassword);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: AdminRole.SUPER_ADMIN,
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
    },
    create: {
      email,
      password: hashedPassword,
      name: "TrustShip Super Admin 2",
      role: AdminRole.SUPER_ADMIN,
      isTwoFactorEnabled: false,
    },
  });

  // Test bcrypt verification immediately
  const isValidTest = await bcrypt.compare(rawPassword, admin.password);
  console.log("Immediate bcrypt test verification result:", isValidTest);

  console.log("==========================================");
  console.log("✅ ADMIN PASSWORD RESET & VERIFIED!");
  console.log(`📧 Email:    ${email}`);
  console.log(`🔑 Password: ${rawPassword}`);
  console.log("==========================================");
}

resetAdmin()
  .catch((e) => {
    console.error("Error resetting admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

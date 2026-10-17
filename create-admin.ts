import { PrismaClient, AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function createNewAdmin() {
  const email = "superadmin1@trustship.com";
  const rawPassword = "Iamsantandave1!";
  
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

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

  console.log("==========================================");
  console.log("✅ NEW SUPER ADMIN CREATED SUCCESSFULLY!");
  console.log(`📧 Email:    ${email}`);
  console.log(`🔑 Password: ${rawPassword}`);
  console.log("==========================================");
}

createNewAdmin()
  .catch((e) => {
    console.error("Error creating admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

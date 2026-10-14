import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.adminUser.updateMany({
    data: { role: 'SUPER_ADMIN' },
  });
  console.log(`Successfully upgraded ${updated.count} admin(s) to SUPER_ADMIN.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

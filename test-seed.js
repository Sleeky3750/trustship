const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const transaction = await prisma.escrowTransaction.create({
    data: {
      transactionRef: "TS-TEST-001",
      buyerPhone: "2348012345678", // Put your exact WhatsApp number here
      sellerPhone: "2349162483537",
      totalEscrow: 5000,
      termsAcceptedByBuyer: false,
      status: "DELIVERED", // Set to DELIVERED so we can test the PIN right away
      releasePin: "1234",
    },
  });
  console.log("Created test transaction successfully:", transaction);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });  

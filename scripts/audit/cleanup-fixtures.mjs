// scripts/audit/cleanup-fixtures.mjs
//
// Removes every `.test` fixture account and all synthetic audit data.
// Run this after the E2E suites, and ALWAYS before a real deployment.
// See docs/audit/OPERATIONS_RUNBOOK.md.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.adminUser.deleteMany({
    where: { email: { endsWith: '@trustship.test' } },
  });
  await prisma.refund.deleteMany({ where: { transactionRef: { startsWith: 'TS-ESCROW-AUDIT-' } } });
  await prisma.transactionEvent.deleteMany({ where: { transactionRef: { startsWith: 'TS-ESCROW-AUDIT-' } } });
  await prisma.dispute.deleteMany({ where: { transactionRef: { startsWith: 'TS-ESCROW-AUDIT-' } } });
  await prisma.escrowTransaction.deleteMany({ where: { transactionRef: { startsWith: 'TS-ESCROW-AUDIT-' } } });
  await prisma.user.deleteMany({ where: { name: { in: ['Audit Buyer', 'Audit Seller'] } } });

  console.log(`deleted ${admins.count} .test admin account(s) and synthetic audit data`);

  const remaining = await prisma.adminUser.findMany({
    select: { email: true, role: true, isTwoFactorEnabled: true },
  });
  console.log('remaining admins:', JSON.stringify(remaining));
  await prisma.$disconnect();
}

main().finally(() => prisma.$disconnect());

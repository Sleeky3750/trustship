// scripts/audit/seed-rbac-fixtures.mjs
//
// Seeds the three `.test` admin fixtures used by the RBAC E2E suites:
//
//   e2e-admin@trustship.test    SUPER_ADMIN       (admin-security-e2e super role)
//   e2e-support@trustship.test  SUPPORT_MODERATOR (least-privilege denials)
//   e2e-finance@trustship.test  FINANCE_ADMIN     (finance-only capabilities)
//
// These are TEST-ONLY accounts. They must be deleted from any real environment
// before launch (see docs/audit/OPERATIONS_RUNBOOK.md, pre-production checklist,
// and docs/audit/LAUNCH_READINESS.md, blocker B-4).
//
// Idempotent: re-running resets the password/role/2FA state so a torn-down
// fixture can be recreated between suites.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const FIXTURES = [
  ['e2e-admin@trustship.test', 'TestE2E!2026', 'SUPER_ADMIN'],
  ['e2e-support@trustship.test', 'SupportMod!2026', 'SUPPORT_MODERATOR'],
  ['e2e-finance@trustship.test', 'FinanceAdm!2026', 'FINANCE_ADMIN'],
];

async function main() {
  for (const [email, pw, role] of FIXTURES) {
    const password = await bcrypt.hash(pw, 12);
    await prisma.adminUser.upsert({
      where: { email },
      update: { password, role, isTwoFactorEnabled: false, twoFactorSecret: null },
      create: { email, password, name: email, role },
    });
  }
  console.log('rbac fixtures ready:', FIXTURES.map((f) => f[0]).join(', '));
}

main().finally(() => prisma.$disconnect());

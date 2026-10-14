// lib/audit.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function logAdminAction({
  adminId,
  action,
  targetId,
  details,
  ipAddress,
}: {
  adminId: string;
  action: string;
  targetId?: string;
  details?: string;
  ipAddress?: string;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        targetId,
        details,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}// lib/audit.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function logAdminAction({
  adminId,
  action,
  targetId,
  details,
  ipAddress,
}: {
  adminId: string;
  action: string;
  targetId?: string;
  details?: string;
  ipAddress?: string;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        targetId,
        details,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
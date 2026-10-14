import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100, // Fetch latest 100 logs for performance
      include: {
        admin: {
          select: { email: true, role: true },
        },
      },
    });

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

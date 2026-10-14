import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logAdminAction } from '@/lib/audit';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    // 1. Identify current admin from session/cookie
    // (Assuming you decode the session to get the admin ID and email)
    const adminId = request.headers.get('x-admin-id'); // Or extracted from session cookie
    
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });

    // 2. Enforce Role Check
    if (!admin || (admin.role !== 'SUPER_ADMIN' && admin.role !== 'FINANCE')) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to release funds.' },
        { status: 403 }
      );
    }

    const { transactionId } = await request.json();

    // Perform release logic here...

    // 3. Log the sensitive action
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    await logAdminAction({
      adminId: admin.id,
      action: 'RELEASE_FUNDS',
      targetId: transactionId,
      details: `Funds released for transaction ${transactionId}`,
      ipAddress: clientIp,
    });

    return NextResponse.json({ success: true, message: 'Funds released securely' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
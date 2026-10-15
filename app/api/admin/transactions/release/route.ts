import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('trustship_admin_session');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: sessionCookie.value },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient privileges to release escrow funds.' },
        { status: 403 }
      );
    }

    const { transactionId } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.status === 'RELEASED') {
      return NextResponse.json({ error: 'Transaction is already released' }, { status: 400 });
    }

    const updatedTransaction = await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: { status: 'RELEASED' },
    });

    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1';

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'RELEASE_ESCROW',
        ipAddress,
        details: `Released escrow funds for transaction reference: ${transaction.transactionRef}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Escrow funds successfully released',
      transaction: updatedTransaction,
    });
  } catch (error: any) {
    console.error('Escrow release error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

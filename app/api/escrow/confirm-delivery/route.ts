import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { transactionId, buyerPhone } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (buyerPhone && transaction.buyerPhone !== buyerPhone) {
      return NextResponse.json({ error: 'Unauthorized: Phone number does not match buyer' }, { status: 403 });
    }

    // Update status securely with data object and type cast
    const updatedTx = await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: { status: 'RELEASED' as any },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: 'BUYER_ACTION',
        action: 'CONFIRM_DELIVERY',
        ipAddress: request.headers.get('x-forwarded-for') || 'BUYER_WHATSAPP',
        details: `Buyer confirmed delivery for ref: ${updatedTx.transactionRef}. Funds released.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Delivery confirmed successfully. Funds released.',
      transaction: updatedTx,
    });
  } catch (error: any) {
    console.error('Confirm delivery error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

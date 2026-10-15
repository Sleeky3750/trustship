import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

async function sendWhatsAppNotification(toPhone: string, textMessage: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return;

  try {
    await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: textMessage },
      }),
    });
  } catch (err) {
    console.error('Failed to send WhatsApp notification:', err);
  }
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const signature = request.headers.get('x-paystack-signature');
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    // 1. MANDATORY SECURITY GUARD: Enforce HMAC SHA-512 Signature
    if (!paystackSecret) {
      console.error('CRITICAL: PAYSTACK_SECRET_KEY environment variable missing.');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    if (!signature) {
      console.warn('SECURITY ALERT: Missing x-paystack-signature header.');
      return NextResponse.json({ error: 'Unauthorized: Missing signature' }, { status: 401 });
    }

    const expectedHash = crypto
      .createHmac('sha512', paystackSecret)
      .update(bodyText)
      .digest('hex');

    if (expectedHash !== signature) {
      console.warn('SECURITY ALERT: Paystack signature mismatch detected!');
      return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(bodyText);

    // 2. Filter for charge.success event
    if (payload.event === 'charge.success') {
      const data = payload.data;
      const metadata = data.metadata || {};
      const transactionId = metadata.transactionId;

      if (transactionId) {
        // 3. IDEMPOTENCY GUARD: Check existing state before updating
        const existingTx = await prisma.escrowTransaction.findUnique({
          where: { id: transactionId },
        });

        if (!existingTx) {
          return NextResponse.json({ error: 'Transaction record not found' }, { status: 404 });
        }

        // Prevent double processing if already funded or released
        if (existingTx.status === 'FUNDED' || existingTx.status === 'RELEASED') {
          console.log(`Transaction ${transactionId} already processed (${existingTx.status}). Skipping.`);
          return NextResponse.json({ status: 'ignored_already_processed' }, { status: 200 });
        }

        // Update status securely
        const updatedTx = await prisma.escrowTransaction.update({
          where: { id: transactionId },
          data: { status: 'FUNDED' },
        });

        // Create immutable audit log for financial deposit
        await prisma.adminAuditLog.create({
          data: {
            adminId: 'SYSTEM_PAYSTACK_WEBHOOK',
            action: 'ESCROW_FUNDED',
            ipAddress: request.headers.get('x-forwarded-for') || 'PAYSTACK_WEBHOOK',
            details: `Paystack deposit confirmed for ref: ${updatedTx.transactionRef}. Paystack reference: ${data.reference}`,
          },
        });

        // Send notifications
        if (updatedTx.buyerPhone && updatedTx.buyerPhone !== 'Pending') {
          const buyerMsg = `🟢 *Escrow Payment Confirmed!*\n\nReference: *${updatedTx.transactionRef}*\nAmount: ₦${(updatedTx.totalAmount || updatedTx.itemPrice || 0).toLocaleString()}\n\nYour funds are securely locked in TrustShip Escrow. They will only be released after you inspect and confirm delivery.`;
          await sendWhatsAppNotification(updatedTx.buyerPhone, buyerMsg);
        }

        if (updatedTx.sellerPhone && updatedTx.sellerPhone !== 'Pending') {
          const sellerMsg = `📦 *Escrow Funded - Safe to Ship!*\n\nReference: *${updatedTx.transactionRef}*\nAmount: ₦${(updatedTx.totalAmount || updatedTx.itemPrice || 0).toLocaleString()}\n\nThe buyer has deposited funds into TrustShip Escrow. You can now dispatch the item safely.`;
          await sendWhatsAppNotification(updatedTx.sellerPhone, sellerMsg);
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Paystack Webhook Security Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

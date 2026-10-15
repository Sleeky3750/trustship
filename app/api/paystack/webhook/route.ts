import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

async function sendWhatsAppNotification(toPhone: string, textMessage: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log('WhatsApp tokens unconfigured. Skipping outbound notification.');
    return;
  }

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

    // Optional: Verify Paystack HMAC SHA512 signature if secret key is present
    if (paystackSecret && signature) {
      const hash = crypto
        .createHmac('sha512', paystackSecret)
        .update(bodyText)
        .digest('hex');

      if (hash !== signature) {
        return NextResponse.json({ error: 'Invalid Paystack signature' }, { status: 400 });
      }
    }

    const payload = JSON.parse(bodyText);

    // Filter for charge.success event
    if (payload.event === 'charge.success') {
      const data = payload.data;
      const metadata = data.metadata || {};
      const transactionId = metadata.transactionId;
      const reference = data.reference;

      console.log(`Paystack payment confirmed for reference: ${reference}`);

      if (transactionId) {
        // Update database record to FUNDED
        const updatedTx = await prisma.escrowTransaction.update({
          where: { id: transactionId },
          data: { status: 'FUNDED' },
        });

        // Notify Buyer on WhatsApp
        if (updatedTx.buyerPhone && updatedTx.buyerPhone !== 'Pending') {
          const buyerMsg = `🟢 *Escrow Payment Confirmed!*\n\nReference: *${updatedTx.transactionRef}*\nAmount: ₦${(updatedTx.totalAmount || updatedTx.itemPrice || 0).toLocaleString()}\n\nYour funds are securely locked in TrustShip Escrow. They will only be released after you inspect and confirm delivery.`;
          await sendWhatsAppNotification(updatedTx.buyerPhone, buyerMsg);
        }

        // Notify Seller on WhatsApp if seller phone exists
        if (updatedTx.sellerPhone && updatedTx.sellerPhone !== 'Pending') {
          const sellerMsg = `📦 *Escrow Funded - Safe to Ship!*\n\nReference: *${updatedTx.transactionRef}*\nAmount: ₦${(updatedTx.totalAmount || updatedTx.itemPrice || 0).toLocaleString()}\n\nThe buyer has deposited funds into TrustShip Escrow. You can now dispatch the item safely.`;
          await sendWhatsAppNotification(updatedTx.sellerPhone, sellerMsg);
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Paystack Webhook Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

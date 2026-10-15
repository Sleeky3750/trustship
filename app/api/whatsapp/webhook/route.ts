import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

// VERIFY WEBHOOK (Meta Cloud API Handshake)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'trustship_whatsapp_secret';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp Webhook Verified Successfully');
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// HANDLE INCOMING MESSAGES
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if message payload exists
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message) {
      const senderPhone = message.from; // e.g. "2348012345678"
      const text = message.text?.body?.trim() || '';

      console.log(`Received WhatsApp message from ${senderPhone}: ${text}`);

      // Basic Command Parser: e.g. "escrow 50000 iPhone 13" or "start"
      if (text.toLowerCase().startsWith('escrow') || text.toLowerCase().startsWith('create')) {
        const parts = text.split(' ');
        const amount = parseFloat(parts[1]) || 10000;
        const itemDescription = parts.slice(2).join(' ') || 'Escrow Item';

        const txRef = `TS-WA-${Math.floor(100000 + Math.random() * 900000)}`;

        // Create Transaction Record in Database
        const transaction = await prisma.escrowTransaction.create({
          data: {
            transactionRef: txRef,
            buyerPhone: senderPhone,
            sellerPhone: 'Pending',
            itemPrice: amount,
            totalAmount: amount,
            status: 'PENDING_DEPOSIT',
            countryCode: 'NG',
            currency: 'NGN',
            paymentProvider: 'PAYSTACK',
          },
        });

        const checkoutUrl = `https://${process.env.NEXT_PUBLIC_APP_URL || 'trustship.app'}/checkout/${transaction.id}`;

        // Return JSON confirmation or trigger Meta API response
        return NextResponse.json({
          status: 'success',
          reply: `🛡️ *TrustShip Escrow Created!*\n\nReference: *${txRef}*\nAmount: ₦${amount.toLocaleString()}\nItem: ${itemDescription}\n\n👇 Click to deposit funds:\n${checkoutUrl}`,
        });
      }
    }

    return NextResponse.json({ status: 'ignored' }, { status: 200 });
  } catch (error: any) {
    console.error('WhatsApp Webhook Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

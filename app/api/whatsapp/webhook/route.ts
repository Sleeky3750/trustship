import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

// Helper to verify Meta HMAC SHA-256 Signature
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    // If WHATSAPP_APP_SECRET isn't set yet in dev, log warning but allow transition
    console.warn('WARNING: WHATSAPP_APP_SECRET not set. Skipping Meta signature check.');
    return true;
  }

  if (!signatureHeader) return false;

  const [algorithm, signature] = signatureHeader.split('=');
  if (algorithm !== 'sha256' || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Helper to send outbound WhatsApp messages
async function sendWhatsAppMessage(toPhone: string, textMessage: string) {
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
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}

// VERIFY WEBHOOK (Meta Cloud API Handshake)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'trustship_whatsapp_secret';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// HANDLE INCOMING MESSAGES
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    // Security Check: Validate payload against Meta App Secret
    if (!verifyMetaSignature(rawBody, signature)) {
      console.warn('SECURITY ALERT: Invalid Meta signature on incoming WhatsApp webhook!');
      return NextResponse.json({ error: 'Unauthorized payload' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message) {
      const senderPhone = message.from;
      const text = message.text?.body?.trim() || '';

      if (text.toLowerCase().startsWith('escrow') || text.toLowerCase().startsWith('create')) {
        const parts = text.split(' ');
        const amount = Math.abs(parseFloat(parts[1])) || 10000;
        const itemDescription = parts.slice(2).join(' ') || 'Escrow Item';

        // Sanitize input amount
        if (isNaN(amount) || amount <= 0) {
          await sendWhatsAppMessage(senderPhone, '⚠️ Please provide a valid transaction amount. Example: `escrow 50000 iPhone 13`');
          return NextResponse.json({ status: 'invalid_amount' }, { status: 200 });
        }

        const txRef = `TS-WA-${Math.floor(100000 + Math.random() * 900000)}`;

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

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trustship.app';
        const checkoutUrl = `${baseUrl}/checkout/${transaction.id}`;

        const replyMessage = `🛡️ *TrustShip Escrow Created!*\n\nReference: *${txRef}*\nAmount: ₦${amount.toLocaleString()}\nItem: ${itemDescription}\n\n👇 Click to deposit funds into secure escrow:\n${checkoutUrl}`;

        await sendWhatsAppMessage(senderPhone, replyMessage);

        return NextResponse.json({ status: 'success' });
      }
    }

    return NextResponse.json({ status: 'ignored' }, { status: 200 });
  } catch (error: any) {
    console.error('WhatsApp Webhook Security Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

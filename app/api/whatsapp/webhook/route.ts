import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";

// GET: Meta Verification Handshake
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// POST: Incoming WhatsApp Message Processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log payload
    await prisma.webhookLog.create({
      data: {
        provider: "WHATSAPP",
        payload: body,
      },
    });

    const entries = body.entry;
    if (entries && Array.isArray(entries)) {
      for (const entry of entries) {
        const changes = entry.changes;
        if (changes && Array.isArray(changes)) {
          for (const change of changes) {
            const value = change.value;
            if (value && value.messages && Array.isArray(value.messages)) {
              for (const message of value.messages) {
                const from = message.from; // Phone number of sender
                if (message.type === "text" && message.text?.body) {
                  await processIncomingMessage(from, message.text.body.trim());
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: any) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Message State Handler
async function processIncomingMessage(from: string, text: string) {
  const cleanText = text.trim();
  const isPin = /^\d{4}$/.test(cleanText);

  // 1. PIN Release Handler
  if (isPin) {
    const pin = cleanText;

    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        buyerPhone: from,
        releasePin: pin,
        status: { in: ["ESCROW_LOCKED", "DELIVERED"] },
      },
      include: { seller: true },
    });

    if (transaction) {
      await prisma.escrowTransaction.update({
        where: { id: transaction.id },
        data: { status: "RELEASED" },
      });

      // Initiate Payout Transfer via Flutterwave
      try {
        if (transaction.seller.bankCode && transaction.seller.accountNumber) {
          await initiateFlutterwaveTransfer({
              accountBank: transaction.seller.bankCode,
              accountNumber: transaction.seller.accountNumber,
              amount: transaction.totalEscrow,
              narration: `TrustShip Payout for Escrow ${transaction.transactionRef}`,
              reference: `TS-WA-REL-${transaction.id}-${Date.now()}`,
              beneficiaryName: transaction.seller.name || "TrustShip Seller",
            });
        }
      } catch (transferErr: any) {
        console.error("WhatsApp triggered transfer payout error:", transferErr);
      }

      await sendWhatsAppMessage(
        from,
        `✅ PIN Verified! Payment of ₦${transaction.totalEscrow.toLocaleString()} has been released to the seller for escrow *${transaction.transactionRef}*. Thank you for using TrustShip!`
      );

      if (transaction.sellerPhone) {
        await sendWhatsAppMessage(
          transaction.sellerPhone,
          `🎉 Escrow Released! The buyer verified delivery for trade *${transaction.transactionRef}*. ₦${transaction.totalEscrow.toLocaleString()} has been sent to your bank.`
        );
      }
    } else {
      await sendWhatsAppMessage(
        from,
        `❌ Invalid PIN or no active escrow awaiting release was found for your account.`
      );
    }
    return;
  }

  // 2. Transaction Reference Lookup Handler
  if (cleanText.toUpperCase().startsWith("TS-")) {
    const ref = cleanText.toUpperCase();

    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        transactionRef: ref,
        OR: [{ buyerPhone: from }, { sellerPhone: from }],
      },
    });

    if (transaction) {
      await sendWhatsAppMessage(
        from,
        `🛡️ *TrustShip Escrow Status: ${ref}*\n\n` +
        `• Status: *${transaction.status}*\n` +
        `• Amount: ₦${transaction.totalEscrow.toLocaleString()}\n` +
        `• Waybill: ₦${transaction.waybillAmount.toLocaleString()} (${transaction.waybillPayer})\n` +
        `• Dispatch: ${transaction.dispatchStatus}\n\n` +
        `_Reply with your 4-digit PIN once item is received to release funds to the seller._`
      );
    } else {
      await sendWhatsAppMessage(
        from,
        `❌ No matching transaction found for reference *${ref}*.`
      );
    }
    return;
  }

  // 3. Fallback Info Message
  await sendWhatsAppMessage(
    from,
    `Welcome to *TrustShip Escrow* 🛡️\n\n` +
    `• Reply with your reference (e.g. *TS-ESCROW-XXXX*) to view status.\n` +
    `• Reply with your 4-digit *Release PIN* to release funds to seller after delivery.`
  );
}
import { NextResponse } from "next/server";
import { PrismaClient, TransactionStatus } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();

// 1. Meta Webhook Verification (GET)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "trustship_secure_token";

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully by Meta!");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// 2. Incoming WhatsApp Message Handler (POST)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "messages") {
            const value = change.value;
            if (value && value.messages && value.messages.length > 0) {
              const message = value.messages[0];
              const senderPhone = message.from; 
              const messageText = message.text?.body?.trim();

              if (!messageText) continue;

              console.log(`📩 Received WhatsApp message from ${senderPhone}: "${messageText}"`);

              // If text is a 4-digit PIN, try processing the release
              if (/^\d{4}$/.test(messageText)) {
                await handlePinRelease(senderPhone, messageText);
              } else {
                await sendWhatsAppMessage(
                  senderPhone,
                  "Welcome to TrustShip! Reply with your 4-digit release PIN once you've received and inspected your item."
                );
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error: any) {
    console.error("WhatsApp Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Core Logic: Match PIN, release escrow, and trigger payout
async function handlePinRelease(buyerPhone: string, pin: string) {
  try {
    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        buyerPhone: buyerPhone,
        releasePin: pin,
        status: TransactionStatus.DELIVERED,
      },
      include: { seller: true, buyer: true },
    });

    if (!transaction) {
      await sendWhatsAppMessage(
        buyerPhone,
        `❌ Invalid PIN or no delivered transaction found waiting for release with PIN *${pin}*.`
      );
      return;
    }

    // 1. Update status to RELEASED
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.RELEASED },
    });

    console.log(`🎉 Escrow ${updated.transactionRef} successfully RELEASED!`);

    // 2. Trigger Automated Paystack Payout to Seller
    await processSellerPayout(transaction);

    // 3. Notify Buyer
    await sendWhatsAppMessage(
      buyerPhone,
      `✅ Success! Funds for transaction *${transaction.transactionRef}* have been released and sent to the seller's bank account. Thank you for using TrustShip!`
    );

    // 4. Notify Seller
    if (transaction.sellerPhone) {
      await sendWhatsAppMessage(
        transaction.sellerPhone,
        `💰 Payout Alert! The buyer released funds for transaction *${transaction.transactionRef}*. NGN ${transaction.itemAmount} has been transferred to your account (${transaction.seller.bankName} - ${transaction.seller.accountNumber}).`
      );
    }
  } catch (err) {
    console.error("Error processing PIN release and payout:", err);
  }
}

// Helper: Initiate Paystack Payout to Seller
async function processSellerPayout(transaction: any) {
  const seller = transaction.seller;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

  if (!paystackSecret) {
    console.warn("⚠️ PAYSTACK_SECRET_KEY missing. Skipping live payout execution.");
    return;
  }

  try {
    console.log(`🏦 Creating Paystack transfer recipient for seller: ${seller.name}...`);

    // Step A: Create Transfer Recipient
    const recipientRes = await axios.post(
      "https://api.paystack.co/transferrecipient",
      {
        type: "nuban",
        name: seller.name,
        account_number: seller.accountNumber,
        bank_code: seller.bankCode,
        currency: "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      }
    );

    const recipientCode = recipientRes.data.data.recipient_code;
    const transferAmountInKobo = Math.round(transaction.itemAmount * 100);

    console.log(`💸 Initiating transfer of ₦${transaction.itemAmount} to recipient ${recipientCode}...`);

    // Step B: Initiate Transfer from Balance
    const transferRes = await axios.post(
      "https://api.paystack.co/transfer",
      {
        source: "balance",
        amount: transferAmountInKobo,
        recipient: recipientCode,
        reason: `TrustShip Payout - Ref: ${transaction.transactionRef}`,
      },
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Payout successfully queued! Transfer Code: ${transferRes.data.data.transfer_code}`);
    return transferRes.data.data;
  } catch (error: any) {
    console.error("❌ Paystack Payout Failed:", error.response?.data || error.message);
    throw new Error("Payout execution failed");
  }
}

// Helper: Send WhatsApp messages via Meta Cloud API
async function sendWhatsAppMessage(to: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneNumberId || !token) {
    console.warn("WhatsApp credentials missing; skipping outbound message.");
    return;
  }

  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("Failed to send outbound WhatsApp message:", err.response?.data || err.message);
  }
}
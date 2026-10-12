import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transactionRef } = body;

    if (!transactionRef) {
      return NextResponse.json(
        { error: "Missing required field: transactionRef" },
        { status: 400 }
      );
    }

    // 1. Find the transaction
    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
      include: { buyer: true },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (transaction.status === "RELEASED") {
      return NextResponse.json(
        { error: "This transaction has already been completed and released." },
        { status: 400 }
      );
    }

    // 2. Update transaction status to DELIVERED
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "DELIVERED",
        dispatchStatus: "DELIVERED",
      },
    });

    console.log(`📦 Transaction ${transactionRef} marked as DELIVERED.`);

    // 3. Dispatch the Release PIN to the buyer via WhatsApp
    if (transaction.buyerPhone && transaction.releasePin) {
      await sendWhatsAppNotification(
        transaction.buyerPhone,
        `📦 Your item for escrow reference *${transaction.transactionRef}* has been marked as delivered!\n\nOnce you've inspected your item, reply with your 4-digit PIN *${transaction.releasePin}* to release funds to the seller.`
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Transaction marked as delivered. PIN dispatched to buyer.",
        data: {
          transactionRef: updated.transactionRef,
          status: updated.status,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Failed to mark delivery:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error during delivery update" },
      { status: 500 }
    );
  }
}

// Helper: Outbound WhatsApp notification sender
async function sendWhatsAppNotification(to: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneNumberId || !token) return;

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
  } catch (err) {
    console.error("Failed to send WhatsApp delivery notice:", err);
  }
}
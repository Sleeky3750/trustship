import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { TransactionStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const { transactionRef } = await request.json();

    if (!transactionRef) {
      return NextResponse.json(
        { error: "Transaction reference is required" },
        { status: 400 }
      );
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Prevent duplicate processing
    if (transaction.status === TransactionStatus.DELIVERED) {
      return NextResponse.json(
        { message: "Delivery already confirmed for this transaction" },
        { status: 200 }
      );
    }

    // Mark shipment as DELIVERED with timestamp
    const now = new Date();
    const updatedTransaction = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.DELIVERED,
        dispatchStatus: "DELIVERED",
        updatedAt: now,
      },
    });

    // WhatsApp Inspection Prompt: Alert buyer via WhatsApp to inspect the item and input/share the Release PIN
    if (transaction.buyerPhone) {
      const inspectionMessage = `📦 *Delivery Confirmed (${transactionRef})*\n\n` +
        `The item has been marked as delivered.\n\n` +
        `• Please inspect the item carefully.\n` +
        `• Share or input the 4-digit Release PIN to release funds to the seller.\n` +
        `• You have a 7-day inspection window to raise any disputes.\n\n` +
        `Release PIN: ${transaction.releasePin}`;

      await sendWhatsAppMessage(transaction.buyerPhone, inspectionMessage);
    }

    return NextResponse.json({
      success: true,
      message: "Delivery confirmed and inspection prompt sent via WhatsApp",
      transaction: updatedTransaction,
    });
  } catch (error: any) {
    console.error("Confirm delivery error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
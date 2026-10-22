import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { TransactionStatus } from "@prisma/client";
import { verifyActionToken } from "@/lib/action-token";
import { recordEvent, EVENTS } from "@/lib/events";

/** Only a dispatched escrow can have its delivery confirmed. */
const CONFIRMABLE_STATUSES: TransactionStatus[] = ["DISPATCHED", "ESCROW_LOCKED"];

export async function POST(request: NextRequest) {
  try {
    const { transactionRef, actionToken } = await request.json();

    if (!transactionRef) {
      return NextResponse.json(
        { error: "Transaction reference is required" },
        { status: 400 }
      );
    }

    // Public route: confirming delivery triggers the release-PIN message, so
    // it requires a server-minted, signed action token bound to this exact
    // transaction + transition. Checked BEFORE the lookup so the endpoint
    // cannot be used as a transactionRef existence oracle either.
    if (!verifyActionToken(actionToken, "confirm-delivery", transactionRef)) {
      return NextResponse.json(
        { error: "Missing or invalid action token" },
        { status: 401 }
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

    // Only a dispatched (or otherwise funded) escrow can be delivered. This
    // stops a valid token for a not-yet-funded escrow from skipping the
    // lifecycle and prematurely exposing the release prompt.
    if (!CONFIRMABLE_STATUSES.includes(transaction.status)) {
      return NextResponse.json(
        { error: `Transaction is ${transaction.status}; it cannot be confirmed as delivered.` },
        { status: 409 }
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

    await recordEvent({
      transactionId: transaction.id,
      transactionRef,
      type: EVENTS.BUYER_CONFIRMED,
      message: "Buyer confirmed delivery; inspection window opened",
      actorKind: "BUYER",
      metadata: { from: transaction.status, to: "DELIVERED" },
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
      { error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
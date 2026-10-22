import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { verifyActionToken } from "@/lib/action-token";
import { recordEvent, EVENTS } from "@/lib/events";

/** Only a funded escrow can be dispatched. */
const DISPATCHABLE_STATUSES = ["ESCROW_LOCKED", "DISPATCHED"];

export async function POST(request: NextRequest) {
  try {
    const { transactionRef, courierName, courierPhone, actionToken } = await request.json();

    if (!transactionRef) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    // Public route: require a server-minted, signed action token bound to this
    // exact transaction + transition. Checked BEFORE the lookup so the endpoint
    // cannot be used as a transactionRef existence oracle either.
    if (!verifyActionToken(actionToken, "dispatch", transactionRef)) {
      return NextResponse.json(
        { error: "Missing or invalid action token" },
        { status: 401 }
      );
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // A valid token is necessary but not sufficient: only a funded escrow may
    // be dispatched, so a token minted for a different lifecycle point cannot
    // skip straight to DISPATCHED.
    if (!DISPATCHABLE_STATUSES.includes(transaction.status)) {
      return NextResponse.json(
        { error: `Transaction is ${transaction.status}; it cannot be dispatched.` },
        { status: 409 }
      );
    }

    // Update dispatch details and status
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "DISPATCHED",
        dispatchStatus: "IN_TRANSIT",
        ...(courierName ? { courierName } : {}),
        ...(courierPhone ? { courierPhone } : {}),
      },
    });

    await recordEvent({
      transactionId: transaction.id,
      transactionRef,
      type: EVENTS.DELIVERY_INITIATED,
      message: `Item dispatched${courierName ? ` via ${courierName}` : ""}`,
      actorKind: "SELLER",
      metadata: { courierName: courierName ?? null, from: transaction.status, to: "DISPATCHED" },
    });

    // Notify buyer via WhatsApp
    if (transaction.buyerPhone) {
      const whatsappMessage = `📦 *Escrow Update (${transactionRef})*\n\n` +
        `Your item has been *DISPATCHED*!${
          courierName ? `\n• Courier: ${courierName}` : ""
        }${courierPhone ? `\n• Courier Phone: ${courierPhone}` : ""}\n\n` +
        `Please inspect the package carefully upon delivery.`;

      await sendWhatsAppMessage(transaction.buyerPhone, whatsappMessage);
    }

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error: any) {
    console.error("Dispatch update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
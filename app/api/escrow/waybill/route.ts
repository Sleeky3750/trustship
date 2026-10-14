import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const { transactionRef, dispatchStatus } = await req.json();

    if (!transactionRef || !dispatchStatus) {
      return NextResponse.json({ error: "Missing transactionRef or dispatchStatus" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findFirst({
      where: { transactionRef },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Update dispatch status in database
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        dispatchStatus,
        updatedAt: new Date(),
      },
    });

    // Notify Buyer via WhatsApp when status moves to DELIVERED
    if (dispatchStatus === "DELIVERED" && transaction.buyerPhone) {
      await sendWhatsAppMessage(
        transaction.buyerPhone,
        `📦 *Waybill Update for ${transaction.transactionRef}*\n\n` +
        `Your item has been delivered!\n\n` +
        `Please inspect your package. Once satisfied, reply directly in this chat with your 4-digit Release PIN (*${transaction.releasePin}*) to complete the trade.`
      );
    }

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error: any) {
    console.error("Waybill update error:", error);
    return NextResponse.json({ error: "Failed to update waybill status" }, { status: 500 });
  }
}

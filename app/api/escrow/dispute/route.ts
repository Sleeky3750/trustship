import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { DisputeFault, TransactionStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    // Accept either the escrow reference or its database id so both the
    // tracking page (transactionRef) and admin tooling (id) work.
    const { transactionRef, transactionId, disputeFault, reportedBy, reason } =
      await request.json();

    if (!transactionRef && !transactionId) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = transactionRef
      ? await prisma.escrowTransaction.findUnique({ where: { transactionRef } })
      : await prisma.escrowTransaction.findUnique({ where: { id: transactionId } });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Validate dispute fault parameter
    if (!disputeFault || !(disputeFault === DisputeFault.SELLER_FAULT || disputeFault === DisputeFault.BUYER_FAULT)) {
      return NextResponse.json({ error: "Valid dispute fault (SELLER_FAULT or BUYER_FAULT) is required" }, { status: 400 });
    }

    // Update transaction with dispute status and fault
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.DISPUTED,
        disputeFault: disputeFault as DisputeFault,
      },
    });

    // Send WhatsApp notification to both parties about the dispute
    const disputeInfo = `⚠️ *Dispute Raised (${transaction.transactionRef})*\n\n` +
      `A dispute has been raised for this escrow transaction.\n` +
      `• Dispute Fault: ${disputeFault}\n` +
      `• Reported by: ${reportedBy || "Buyer"}\n` +
      `• Reason: ${reason || "Not specified"}`;

    if (transaction.buyerPhone) {
      await sendWhatsAppMessage(transaction.buyerPhone, disputeInfo);
    }
    if (transaction.sellerPhone) {
      await sendWhatsAppMessage(transaction.sellerPhone, disputeInfo);
    }

    return NextResponse.json({
      success: true,
      message: "Dispute recorded and both parties notified via WhatsApp",
      transaction: updated,
    });
  } catch (error: any) {
    console.error("Dispute error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
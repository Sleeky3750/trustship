import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { DisputeFault, TransactionStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const admin = auth.admin;

    // Identity comes from the session — never from the request body.
    const { transactionRef, disputeFault, resolution } = await request.json();
    const resolvedBy = admin.name || admin.email;

    if (!transactionRef) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Validate dispute fault parameter
    if (!disputeFault || !(disputeFault === DisputeFault.SELLER_FAULT || disputeFault === DisputeFault.BUYER_FAULT)) {
      return NextResponse.json({ error: "Valid dispute fault is required" }, { status: 400 });
    }

    // Update transaction with dispute resolution
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.REFUNDED,
        disputeFault: disputeFault as DisputeFault,
        // If fault is seller, buyer gets refund; if fault is buyer, no refund
      },
    });

    // Send WhatsApp notification to both parties about the resolution
    const resolutionMessage = `📋 *Dispute Resolved (${transactionRef})*\n\n` +
      `The dispute has been resolved.\n` +
      `• Resolution: ${resolution || "Not specified"}\n` +
      `• Fault: ${disputeFault}\n` +
      `• Resolved by: ${resolvedBy}`;

    if (transaction.buyerPhone) {
      await sendWhatsAppMessage(transaction.buyerPhone, resolutionMessage);
    }
    if (transaction.sellerPhone) {
      await sendWhatsAppMessage(transaction.sellerPhone, resolutionMessage);
    }

    // Audit the dispute resolution (real client IP + User-Agent).
    await recordAdminAction(request, {
      adminId: admin.id,
      action: "DISPUTE_RESOLVED",
      targetId: transaction.id,
      message: `Resolved dispute on ${transaction.transactionRef} (fault: ${disputeFault}). Resolution: ${resolution || "Not specified"}`,
      changes: {
        status: { from: transaction.status, to: TransactionStatus.REFUNDED },
        disputeFault,
        resolution: resolution || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Dispute resolved and both parties notified via WhatsApp",
      transaction: updated,
    });
  } catch (error: any) {
    console.error("Admin resolve disputes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
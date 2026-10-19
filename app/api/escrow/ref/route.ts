import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { TransactionStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    // Issuing a refund moves money out of escrow: admin session required.
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const { transactionRef, refundReason } = await request.json();

    if (!transactionRef) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Prevent refund on already released/refunded transactions
    if (transaction.status === TransactionStatus.RELEASED || transaction.status === TransactionStatus.REFUNDED) {
      return NextResponse.json({ error: "Cannot refund a released or already refunded transaction" }, { status: 400 });
    }

    // Update transaction status to REFUNDED
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.REFUNDED,
        disputeFault: null,
      },
    });

    // Send WhatsApp notification to both parties about the refund
    const refundMessage = `💰 *Refund Processed (${transactionRef})*\n\n` +
      `A refund has been processed for this escrow transaction.\n` +
      `• Reason: ${refundReason || "Not specified"}\n` +
      `• Full amount will be returned to the buyer's original payment method.`;

    if (transaction.buyerPhone) {
      await sendWhatsAppMessage(transaction.buyerPhone, refundMessage);
    }
    if (transaction.sellerPhone) {
      await sendWhatsAppMessage(transaction.sellerPhone, refundMessage);
    }

    // Log the admin action for forensics
    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: "REFUND_BUYER",
          targetId: transaction.id,
          details: `Refunded escrow ${transaction.transactionRef} (₦${transaction.totalEscrow}) to buyer. Reason: ${refundReason || "Not specified"}`,
          ipAddress: "admin-panel",
        },
      });
    } catch (auditErr) {
      console.warn("Audit log failed:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Refund processed and both parties notified via WhatsApp",
      transaction: updated,
    });
  } catch (error: any) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { TransactionStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { computePayoutAmount } from "@/lib/payout";

export async function POST(request: NextRequest) {
  try {
    // Admin identity comes from the admin_token session, never the request body.
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const { transactionRef, reason } = await request.json().catch(() => ({} as any));

    if (!transactionRef) {
      return NextResponse.json({ error: "Transaction reference is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
      include: { seller: true, buyer: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Prevent double release
    if (transaction.status === TransactionStatus.RELEASED) {
      return NextResponse.json({ message: "Funds already released for this transaction" }, { status: 200 });
    }

    // Initiate Flutterwave transfer to seller
    const payoutRef = `TS-ADMIN-REL-${admin.id}-${Date.now()}`;
    const payoutAmount = computePayoutAmount(transaction);

    const transferResult = await initiateFlutterwaveTransfer({
      accountBank: transaction.seller.bankCode,
      accountNumber: transaction.seller.accountNumber,
      amount: payoutAmount,
      narration: `Admin Release for Tx ${transaction.transactionRef} by ${admin.name || admin.id}`,
      reference: payoutRef,
      beneficiaryName: transaction.seller.name || "TrustShip Seller",
    });

    // Update transaction status to RELEASED
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.RELEASED },
    });

    // Notify Seller via WhatsApp
    if (transaction.sellerPhone) {
      try {
        await sendWhatsAppMessage(
          transaction.sellerPhone,
          `🎉 *Admin Released Funds (${transactionRef})*\n\n` +
            `Funds of *₦${payoutAmount.toLocaleString()}* have been released and transferred to your bank account (${transaction.seller.bankName})` +
            `\n\n• Reason: ${reason || "Admin processed release"}`
        );
      } catch (wsErr) {
        console.warn("Failed to send WhatsApp notification:", wsErr);
      }
    }

    // Log the admin action
    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: "ADMIN_RELEASE_FUNDS",
          targetId: transaction.id,
          details: `Released ₦${payoutAmount} to seller ${transaction.seller.id} for transaction ${transaction.transactionRef}. Reason: ${reason || "Not specified"}`,
          ipAddress: "admin-panel", // Would be request IP in real implementation
        },
      });
    } catch (auditErr) {
      console.warn("Audit log failed:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Funds released via admin action",
      payoutAmount,
      payoutReference: payoutRef,
      transaction: updated,
    });
  } catch (error: any) {
    console.error("Admin release funds error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
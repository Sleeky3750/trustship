import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { TransactionStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { computePayoutAmount } from "@/lib/payout";
import { recordAdminAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    // Admin identity comes from the admin_token session, never the body.
    // Fund releases are limited to FINANCE and SUPER_ADMIN (per product intent).
    const auth = await requireAdmin(request, {
      roles: ["SUPER_ADMIN", "FINANCE"],
    });
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const { transactionId } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { id: transactionId },
      include: { seller: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Admin permissions (FINANCE / SUPER_ADMIN) are enforced by requireAdmin above.

    // Prevent double release
    if (transaction.status === TransactionStatus.COMPLETED) {
      return NextResponse.json({ message: "Funds already released for this transaction" }, { status: 200 });
    }

    // Initiate Flutterwave transfer to seller
    const payoutRef = `TS-ADMIN-REL-${transactionId}-${Date.now()}`;
    const payoutAmount = computePayoutAmount(transaction);

    const transferResult = await initiateFlutterwaveTransfer({
      accountBank: transaction.seller.bankCode,
      accountNumber: transaction.seller.accountNumber,
      amount: payoutAmount,
      narration: `Admin Release for Tx ${transaction.transactionRef}`,
      reference: payoutRef,
      beneficiaryName: transaction.seller.name || "TrustShip Seller",
    });

    // Update transaction status to COMPLETED
    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.COMPLETED },
    });

    // Audit with real client IP + User-Agent captured from the request.
    await recordAdminAction(request, {
      adminId: admin.id,
      action: "ESCROW_RELEASED",
      targetId: transaction.id,
      message: `Released ₦${payoutAmount} to seller for transaction ${transaction.transactionRef}`,
      changes: {
        status: { from: transaction.status, to: TransactionStatus.COMPLETED },
        payoutAmount,
        payoutReference: payoutRef,
      },
    });

    // Notify Seller via WhatsApp
    if (transaction.sellerPhone) {
      try {
        await sendWhatsAppMessage(
          transaction.sellerPhone,
          `🎉 *Admin Released Funds*\n\n` +
            `Funds of *₦${payoutAmount.toLocaleString()}* have been released and transferred to your bank account (${transaction.seller.bankName})`
        );
      } catch (wsErr) {
        console.warn("Failed to send WhatsApp notification:", wsErr);
      }
    }

    return NextResponse.json({ success: true, payoutAmount, transaction: updated });
  } catch (error: any) {
    console.error("Admin transaction release error:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
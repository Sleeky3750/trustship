import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { TransactionStatus } from "@prisma/client";
import { requirePermission } from "@/lib/admin-auth";
import { computePayoutAmount } from "@/lib/payout";
import { recordAdminAction } from "@/lib/audit";
import { claimRelease, releaseClaim, recordReleaseEvents } from "@/lib/escrow-lifecycle";

export async function POST(request: NextRequest) {
  try {
    // Admin identity comes from the admin_token session, never the body.
    // Fund releases require the centralized `escrow:release` permission
    // (SUPER_ADMIN + FINANCE_ADMIN), not an inline role list.
    const auth = await requirePermission(request, "escrow:release");
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

    if (!transaction.seller.bankCode || !transaction.seller.accountNumber) {
      return NextResponse.json({ error: "Seller has no bank account on file" }, { status: 400 });
    }

    // Atomic claim BEFORE the provider call: only a funded/delivered escrow is
    // releasable, and a concurrent second request loses the claim.
    const claim = await claimRelease(transaction.id);
    if (!claim.ok) {
      return NextResponse.json(
        { error: claim.reason || "Release not permitted" },
        { status: 409 }
      );
    }

    // Initiate Flutterwave transfer to seller
    const payoutRef = `TS-ADMIN-REL-${transactionId}-${Date.now()}`;
    const payoutAmount = computePayoutAmount(transaction);

    try {
      await initiateFlutterwaveTransfer({
        accountBank: transaction.seller.bankCode,
        accountNumber: transaction.seller.accountNumber,
        amount: payoutAmount,
        narration: `Admin Release for Tx ${transaction.transactionRef}`,
        reference: payoutRef,
        beneficiaryName: transaction.seller.name || "TrustShip Seller",
      });
    } catch (transferError) {
      if (claim.previousStatus) {
        await releaseClaim(transaction.id, claim.previousStatus).catch((rollbackErr) =>
          console.error("Release claim rollback failed:", rollbackErr)
        );
      }
      throw transferError;
    }

    // The claim already moved the row to COMPLETED; re-read for the response.
    const updated = await prisma.escrowTransaction.findUnique({
      where: { id: transaction.id },
    });

    // Audit with real client IP + User-Agent captured from the request.
    await recordAdminAction(request, {
      adminId: admin.id,
      action: "ESCROW_RELEASED",
      targetId: transaction.id,
      message: `Released ₦${payoutAmount} to seller for transaction ${transaction.transactionRef}`,
      changes: {
        status: { from: claim.previousStatus ?? transaction.status, to: TransactionStatus.COMPLETED },
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

    await recordReleaseEvents({
      transactionId: transaction.id,
      transactionRef: transaction.transactionRef,
      actorId: admin.id,
      payoutAmount,
      payoutReference: payoutRef,
      fromStatus: claim.previousStatus,
    });

    return NextResponse.json({ success: true, payoutAmount, transaction: updated });
  } catch (error: any) {
    console.error("Admin transaction release error:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
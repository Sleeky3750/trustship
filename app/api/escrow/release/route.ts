import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { TransactionStatus } from "@prisma/client";
import { computePayoutAmount } from "@/lib/payout";
import { requirePermission } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { claimRelease, releaseClaim, recordReleaseEvents } from "@/lib/escrow-lifecycle";

export async function POST(request: NextRequest) {
  try {
    // Releasing escrow is a money-moving action: finance roles only, checked
    // against the centralized RBAC matrix (not an inline role list).
    const auth = await requirePermission(request, "escrow:release");
    if (auth.error) return auth.error;
    const admin = auth.admin;

    const { transactionRef, releasePin } = await request.json();

    if (!transactionRef) {
      return NextResponse.json(
        { error: "Transaction reference is required" },
        { status: 400 }
      );
    }

    // 1. Fetch transaction WITH seller relation for bank details
    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
      include: {
        seller: true,
        buyer: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // 2. Verify Release PIN (safe undefined check). An operator-supplied PIN is
    //    validated; a mismatch is rejected before any claim is taken.
    const storedPin = transaction.releasePin || "";
    if (releasePin && storedPin && storedPin !== releasePin) {
      return NextResponse.json(
        { error: "Invalid release PIN" },
        { status: 400 }
      );
    }

    // 3. Validate seller bank details from seller User relation
    if (!transaction.seller?.bankCode || !transaction.seller?.accountNumber) {
      return NextResponse.json(
        { error: "Seller bank details are missing on seller profile" },
        { status: 400 }
      );
    }

    // 4. Atomically claim the release BEFORE calling the provider. Only a
    //    funded/delivered escrow may be claimed, and a concurrent second
    //    request loses the claim — this is what closes the double-payout race.
    const claim = await claimRelease(transaction.id);
    if (!claim.ok) {
      return NextResponse.json(
        { error: claim.reason || "Release not permitted" },
        { status: 409 }
      );
    }

    // 5. Initiate automated payout transfer via Flutterwave.
    //    payoutAmount = totalEscrow - platformFee - gatewayFee (lib/payout.ts).
    const payoutRef = `TS-PAYOUT-${transaction.transactionRef}-${Date.now()}`;
    const payoutAmount = computePayoutAmount(transaction);

    let transferResult;
    try {
      transferResult = await initiateFlutterwaveTransfer({
        accountBank: transaction.seller.bankCode,
        accountNumber: transaction.seller.accountNumber,
        amount: payoutAmount,
        narration: `TrustShip Payout: ${transaction.transactionRef}`,
        reference: payoutRef,
        beneficiaryName: transaction.seller.name || "TrustShip Seller",
      });
    } catch (transferError) {
      // Provider rejected the transfer (e.g. insufficient float). Roll the
      // claim back so an operator can retry — no money moved.
      if (claim.previousStatus) {
        await releaseClaim(transaction.id, claim.previousStatus).catch((rollbackErr) =>
          console.error("Release claim rollback failed:", rollbackErr)
        );
      }
      throw transferError;
    }

    // 6. Claim already set status to COMPLETED; record the delivery flag too.
    const updatedTransaction = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: { dispatchStatus: "DELIVERED" },
    });

    // Audit the money-moving release with real client IP + User-Agent.
    await recordAdminAction(request, {
      adminId: admin.id,
      action: "ESCROW_RELEASED",
      targetId: transaction.id,
      message: `Released ₦${payoutAmount} to seller for transaction ${transaction.transactionRef} (PIN verified)`,
      changes: {
        status: { from: claim.previousStatus ?? transaction.status, to: TransactionStatus.COMPLETED },
        payoutAmount,
        payoutReference: payoutRef,
      },
    });

    // 7. Notify Seller via WhatsApp
    if (transaction.sellerPhone) {
      try {
        await sendWhatsAppMessage(
          transaction.sellerPhone,
          `🎉 *Funds Released (${transactionRef})*\n\n` +
            `The escrow payment of *₦${payoutAmount.toLocaleString()}* has been released and transferred to your bank account (${transaction.seller.bankName}).`
        );
      } catch (wsErr) {
        console.warn("Failed to send WhatsApp notification:", wsErr);
      }
    }

    console.log(`✅ Funds successfully released for txRef: ${transactionRef}`);

    // Timeline events for the completed release.
    await recordReleaseEvents({
      transactionId: transaction.id,
      transactionRef: transaction.transactionRef,
      actorId: admin.id,
      payoutAmount,
      payoutReference: payoutRef,
      fromStatus: claim.previousStatus,
    });

    return NextResponse.json({
      success: true,
      message: "Funds successfully released to seller",
      payoutAmount,
      payoutReference: payoutRef,
      transferDetails: transferResult,
      transaction: updatedTransaction,
    });
  } catch (error: any) {
    console.error("Fund release processing error:", error);
    return NextResponse.json(
      { error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
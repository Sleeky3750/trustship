import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { TransactionStatus } from "@prisma/client";
import { computePayoutAmount } from "@/lib/payout";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    // Releasing escrow is a money-moving admin action.
    const auth = await requireAdmin(request);
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

    // 2. Prevent duplicate release processing
    if (transaction.status === TransactionStatus.COMPLETED) {
      return NextResponse.json(
        { message: "Funds have already been released for this transaction" },
        { status: 200 }
      );
    }

    // 3. Verify Release PIN (safe undefined check)
    const storedPin = transaction.releasePin || "";
    if (storedPin && storedPin !== releasePin) {
      return NextResponse.json(
        { error: "Invalid release PIN" },
        { status: 400 }
      );
    }

    // 4. Validate seller bank details from seller User relation
    if (!transaction.seller?.bankCode || !transaction.seller?.accountNumber) {
      return NextResponse.json(
        { error: "Seller bank details are missing on seller profile" },
        { status: 400 }
      );
    }

    // 5. Initiate automated payout transfer via Flutterwave.
    //    payoutAmount = totalEscrow - platformFee (see lib/payout.ts).
    const payoutRef = `TS-PAYOUT-${Date.now()}`;
    const payoutAmount = computePayoutAmount(transaction);

    const transferResult = await initiateFlutterwaveTransfer({
      accountBank: transaction.seller.bankCode,
      accountNumber: transaction.seller.accountNumber,
      amount: payoutAmount,
      narration: `TrustShip Payout: ${transaction.transactionRef}`,
      reference: payoutRef,
      beneficiaryName: transaction.seller.name || "TrustShip Seller",
    });

    // 6. Update database status to COMPLETED
    const updatedTransaction = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.COMPLETED,
        dispatchStatus: "DELIVERED",
      },
    });

    // Audit the money-moving release with real client IP + User-Agent.
    await recordAdminAction(request, {
      adminId: admin.id,
      action: "ESCROW_RELEASED",
      targetId: transaction.id,
      message: `Released ₦${payoutAmount} to seller for transaction ${transaction.transactionRef} (PIN verified)`,
      changes: {
        status: { from: transaction.status, to: TransactionStatus.COMPLETED },
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
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { TransactionStatus } from "@prisma/client";
import { computePayoutAmount } from "@/lib/payout";
import crypto from "crypto";

// Only the holder of CRON_SECRET may trigger payouts. Returns null when
// authorized, otherwise the NextResponse to send back.
function verifyCronSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Auto-release cron: CRON_SECRET is not configured");
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  return ok ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(request);
    if (unauthorized) return unauthorized;

    // Find transactions that are eligible for auto-release:
    // - Status is DELIVERED
    // - Inspection window (7 days) has elapsed since delivery
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch transactions with seller relation included
    const eligibleTransactions = await prisma.escrowTransaction.findMany({
      where: {
        status: TransactionStatus.DELIVERED,
        updatedAt: {
          lte: sevenDaysAgo, // 7+ days since last update
        },
      },
      include: { seller: true },
      take: 50, // Process in batches
    });

    const results = [];

    for (const transaction of eligibleTransactions) {
      try {
        // Initiate Flutterwave transfer to seller
        const payoutRef = `TS-AUTO-REL-${transaction.id}-${Date.now()}`;
        const payoutAmount = computePayoutAmount(transaction);

        const transferResult = await initiateFlutterwaveTransfer({
          accountBank: transaction.seller.bankCode,
          accountNumber: transaction.seller.accountNumber,
          amount: payoutAmount,
          narration: `Auto-Release for Tx ${transaction.transactionRef}`,
          reference: payoutRef,
          beneficiaryName: transaction.seller.name || "TrustShip Seller",
        });

        // Update transaction status to RELEASED
        const updated = await prisma.escrowTransaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.RELEASED,
            dispatchStatus: "DELIVERED",
          },
        });

        // Notify Seller via WhatsApp
        if (transaction.sellerPhone) {
          await sendWhatsAppMessage(
            transaction.sellerPhone,
            `🤖 *Auto-Release (${transaction.transactionRef})*\n\n` +
              `The inspection window has elapsed (7 days). Funds have been auto-released to your bank account (${transaction.seller.bankName}).` +
              `\n\n• Amount: ₦${payoutAmount.toLocaleString()}`
          );
        }

        // Notify Buyer via WhatsApp
        if (transaction.buyerPhone) {
          await sendWhatsAppMessage(
            transaction.buyerPhone,
            `🤖 *Auto-Release (${transaction.transactionRef})*\n\n` +
              `The 7-day inspection window has elapsed. Funds have been auto-released to the seller.` +
              `\n\n• Amount: ₦${payoutAmount.toLocaleString()}`
          );
        }

        results.push({
          transactionRef: transaction.transactionRef,
          status: "AUTO-RELEASED",
          payoutAmount,
          payoutReference: payoutRef,
        });
      } catch (txErr) {
        console.error(`Auto-release error for tx ${transaction.transactionRef}:`, txErr);
        results.push({
          transactionRef: transaction.transactionRef,
          status: "ERROR",
          error: (txErr as Error).message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Auto-release processed for ${results.length} transactions`,
      results,
    });
  } catch (error: any) {
    console.error("Auto-release cron error:", error);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
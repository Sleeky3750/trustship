import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import type { TransactionStatus } from "@prisma/client";

/**
 * GET /api/admin/overview
 *
 * Operational + financial summary for the admin overview dashboard.
 *
 * FINANCIAL DEFINITIONS (documented so the numbers cannot be misread):
 *   totalTransactionValue — sum of `totalEscrow` across ALL escrows ever
 *     created. This is *intent*, not money collected.
 *   verifiedCollections   — sum of `totalEscrow` for escrows that reached a
 *     funded state (ESCROW_LOCKED/DISPATCHED/DELIVERED/DISPUTE_OPEN) or beyond
 *     (COMPLETED/REFUNDED). Backed by a recorded Flutterwave settlement.
 *   fundsHeld             — sum of `totalEscrow` for escrows currently in a
 *     funded, non-terminal state. This is the amount notionally under the
 *     escrow arrangement; it is NOT a claim that cash is physically ring-fenced
 *     (see docs/audit/LAUNCH_READINESS.md).
 *   eligibleForRelease    — sum of (totalEscrow − platformFee − gatewayFee) for
 *     escrows in a releasable state (DISPATCHED/DELIVERED/ESCROW_LOCKED).
 *   released              — sum of payout amounts for escrows in COMPLETED.
 *   refunded              — sum of COMPLETED refund rows (integer kobo → naira).
 *   feesEarned            — platform fees on funded-or-beyond escrows.
 *
 * A database status is NEVER presented as proof that money is physically held
 * or available; the response labels each figure with its basis string.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "transactions:read");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30", 10) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // --- Status counts -------------------------------------------------------
    const grouped = await prisma.escrowTransaction.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { totalEscrow: true, platformFee: true, gatewayFee: true },
    });

    const countByStatus: Record<string, number> = {};
    const valueByStatus: Record<string, number> = {};
    let totalTransactionValue = 0;
    let totalPlatformFees = 0;
    for (const g of grouped) {
      countByStatus[g.status] = g._count._all;
      valueByStatus[g.status] = g._sum.totalEscrow ?? 0;
      totalTransactionValue += g._sum.totalEscrow ?? 0;
      totalPlatformFees += g._sum.platformFee ?? 0;
    }

    const count = (s: string) => countByStatus[s] ?? 0;
    const value = (s: string) => valueByStatus[s] ?? 0;

    const FUNDED: TransactionStatus[] = ["ESCROW_LOCKED", "DISPATCHED", "DELIVERED", "DISPUTE_OPEN"];
    const FUNDED_OR_BEYOND: TransactionStatus[] = [...FUNDED, "COMPLETED", "REFUNDED"];
    const RELEASABLE: TransactionStatus[] = ["DISPATCHED", "DELIVERED", "ESCROW_LOCKED"];

    const sum = (statuses: string[]) =>
      statuses.reduce((acc, s) => acc + value(s), 0);
    const sumCount = (statuses: string[]) =>
      statuses.reduce((acc, s) => acc + count(s), 0);

    // Payout amounts: totalEscrow − platformFee − gatewayFee (matches lib/payout).
    const payoutAgg = await prisma.escrowTransaction.aggregate({
      where: { status: { in: RELEASABLE } },
      _sum: { totalEscrow: true, platformFee: true, gatewayFee: true },
    });
    const eligibleForRelease =
      (payoutAgg._sum?.totalEscrow ?? 0) -
      (payoutAgg._sum?.platformFee ?? 0) -
      (payoutAgg._sum?.gatewayFee ?? 0);

    const completedAgg = await prisma.escrowTransaction.aggregate({
      where: { status: "COMPLETED" },
      _sum: { totalEscrow: true, platformFee: true, gatewayFee: true },
    });
    const released =
      (completedAgg._sum?.totalEscrow ?? 0) -
      (completedAgg._sum?.platformFee ?? 0) -
      (completedAgg._sum?.gatewayFee ?? 0);

    // Refunds: sum of COMPLETED refund rows (stored in integer kobo).
    const refundAgg = await prisma.refund.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amountMinor: true },
    });
    const refunded = (refundAgg._sum.amountMinor ?? 0) / 100;

    const pendingRefunds = await prisma.refund.count({
      where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"] } },
    });

    const activeDisputes = await prisma.dispute.count({
      where: { status: { in: ["OPEN", "UNDER_REVIEW", "AWAITING_BUYER", "AWAITING_SELLER", "ESCALATED"] } },
    });

    const pendingPayouts = await prisma.payoutQueue.count({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
    });
    const failedPayouts = await prisma.payoutQueue.count({ where: { status: "FAILED" } });

    // Webhook health in the window.
    const [webhookTotal, webhookFailed] = await Promise.all([
      prisma.webhookLog.count({ where: { createdAt: { gte: since } } }),
      prisma.webhookLog.count({ where: { createdAt: { gte: since }, status: "FAILED" } }),
    ]);

    // Attention queue: funded but stalled (no update in the window) + disputes.
    const needsAttention = await prisma.escrowTransaction.count({
      where: {
        status: { in: FUNDED },
        updatedAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
    });

    return NextResponse.json({
      success: true,
      windowDays: days,
      counts: {
        total: sumCount(Object.keys(countByStatus)),
        awaitingPayment: count("PENDING_DEPOSIT") + count("PENDING_PAYMENT"),
        awaitingSellerAcceptance: count("PENDING_SELLER_ACCEPTANCE"),
        awaitinAgreement: count("PENDING_AGREEMENT"),
        verifiedFunded: sumCount(FUNDED_OR_BEYOND),
        awaitingDelivery: count("ESCROW_LOCKED"),
        awaitingBuyerConfirmation: count("DISPATCHED"),
        delivered: count("DELIVERED"),
        activeDisputes,
        pendingRefunds,
        completed: count("COMPLETED"),
        refunded: count("REFUNDED"),
        cancelled: count("CANCELLED"),
        failed: count("CANCELLED"), // CANCELLED is the terminal failure state
        needsAttention,
        pendingPayouts,
        failedPayouts,
      },
      financials: {
        currency: "NGN",
        totalTransactionValue: {
          value: round(totalTransactionValue),
          basis: "Sum of totalEscrow across all escrows ever created (intent, not collected).",
        },
        verifiedCollections: {
          value: round(sum(FUNDED_OR_BEYOND)),
          basis:
            "Sum of totalEscrow for escrows with a recorded Flutterwave settlement (funded or beyond).",
        },
        fundsHeld: {
          value: round(sum(FUNDED)),
          basis:
            "Sum of totalEscrow for currently-funded, non-terminal escrows. Not a claim that cash is physically ring-fenced.",
        },
        eligibleForRelease: {
          value: round(eligibleForRelease),
          basis: "Sum of (totalEscrow − platformFee − gatewayFee) for releasable escrows.",
        },
        released: {
          value: round(released),
          basis: "Sum of payout amounts (totalEscrow − fees) for completed escrows.",
        },
        refunded: {
          value: round(refunded),
          basis: "Sum of COMPLETED refund records.",
        },
        feesEarned: {
          value: round(totalPlatformFees),
          basis: "Platform fees on escrows that reached funded-or-beyond.",
        },
        outstandingReconciliation: {
          value: round(sum(FUNDED) - eligibleForRelease - released),
          basis:
            "fundsHeld − eligibleForRelease − released. Illustrative only; full reconciliation requires provider settlement data.",
        },
      },
      webhookHealth: {
        windowDays: days,
        total: webhookTotal,
        failed: webhookFailed,
        failureRate: webhookTotal > 0 ? round(webhookFailed / webhookTotal) : 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Round to 2 decimal places for currency display. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

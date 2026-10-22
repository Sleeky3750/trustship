import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { DisputeFault, TransactionStatus } from "@prisma/client";
import { requirePermission } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/audit";
import { recordEvent, EVENTS } from "@/lib/events";
import { requestRefund, RefundError } from "@/lib/refunds/workflow";

/**
 * POST /api/admin/resolve-disputes
 *
 * Records the OUTCOME of a dispute and applies the correct financial
 * consequence.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * The previous implementation unconditionally set `status = REFUNDED` and told
 * both parties the dispute was resolved — without ever calling Flutterwave to
 * move money back to the buyer. That made the ledger (and the customer) believe
 * a refund had happened when it had not (the same "phantom refund" class as
 * the legacy /api/escrow/ref route).
 *
 * Now:
 *   * BUYER_FAULT (buyer at fault) → the seller is entitled to the funds; the
 *     handler does NOT auto-release (a release is a separate, explicitly
 *     authorised money movement). The dispute is recorded as resolved with the
 *     transaction still holding funds, ready for the normal release path.
 *   * SELLER_FAULT (seller at fault) → a refund REQUEST is opened for the
 *     eligible amount through the real refund workflow. The money moves only
 *     after finance approves and executes it against the provider. The escrow
 *     status is NOT flipped to REFUNDED here.
 *
 * Requires `disputes:resolve_financial` (SUPER_ADMIN / FINANCE_ADMIN): support
 * moderators resolve the case, but only a financial role may trigger the money
 * consequence.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "disputes:resolve_financial");
    if (auth.error) return auth.error;
    const admin = auth.admin;

    // Identity comes from the session — never from the request body.
    const { transactionRef, disputeFault, resolution } = await request
      .json()
      .catch(() => ({} as any));
    const resolvedBy = admin.name || admin.email;

    if (!transactionRef) {
      return NextResponse.json(
        { error: "Transaction reference is required" },
        { status: 400 }
      );
    }

    if (
      !disputeFault ||
      (disputeFault !== DisputeFault.SELLER_FAULT &&
        disputeFault !== DisputeFault.BUYER_FAULT)
    ) {
      return NextResponse.json(
        { error: "Valid dispute fault is required" },
        { status: 400 }
      );
    }

    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.status !== TransactionStatus.DISPUTE_OPEN) {
      return NextResponse.json(
        {
          error: `Transaction is ${transaction.status}; only an open dispute can be resolved.`,
        },
        { status: 409 }
      );
    }

    // SELLER_FAULT → open a real refund request (does NOT move money yet).
    let refundSummary: { id: string; status: string; amountMinor: number } | null =
      null;
    if (disputeFault === DisputeFault.SELLER_FAULT) {
      try {
        const refund = await requestRefund({
          transactionRef,
          reason: `Dispute resolution (seller fault): ${resolution || "Not specified"}`,
          requestedById: admin.id,
        });
        refundSummary = {
          id: refund.id,
          status: refund.status,
          amountMinor: refund.amountMinor,
        };
      } catch (err) {
        if (err instanceof RefundError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
    }

    // Close the dispute case and mark the escrow as resolved-with-funds-held.
    // The escrow stays in a funded state; the actual money movement is handled
    // by whichever path is appropriate (refund approval/execution, or release).
    const resolvedStatus =
      disputeFault === DisputeFault.SELLER_FAULT
        ? transaction.status // funds remain; the refund workflow moves them
        : TransactionStatus.DELIVERED; // buyer fault → seller may be paid via release

    const updated = await prisma.escrowTransaction.update({
      where: { id: transaction.id },
      data: {
        ...(disputeFault === DisputeFault.BUYER_FAULT
          ? { status: resolvedStatus }
          : {}),
        disputeStage: "RESOLVED",
        disputeFault: disputeFault as DisputeFault,
      },
    });

    const openCase = await prisma.dispute.findFirst({
      where: { transactionId: transaction.id, status: { not: "CLOSED" } },
      orderBy: { createdAt: "desc" },
    });
    if (openCase) {
      await prisma.dispute.update({
        where: { id: openCase.id },
        data: {
          status: "RESOLVED",
          assignedToId: admin.id,
          resolution: resolution || "Not specified",
        },
      });
    }

    // WhatsApp: message both parties truthfully about what happens NEXT.
    const resolutionMessage =
      disputeFault === DisputeFault.SELLER_FAULT
        ? `📋 *Dispute Resolved (${transactionRef})*\n\n` +
          `The dispute has been reviewed and resolved in the buyer's favour.\n` +
          `• Resolution: ${resolution || "Not specified"}\n` +
          `• Resolved by: ${resolvedBy}\n\n` +
          `A refund has been *requested* for the eligible amount. It will be ` +
          `processed after review and you will be notified when the refund is ` +
          `confirmed by our payment provider.`
        : `📋 *Dispute Resolved (${transactionRef})*\n\n` +
          `The dispute has been reviewed and resolved.\n` +
          `• Resolution: ${resolution || "Not specified"}\n` +
          `• Resolved by: ${resolvedBy}\n\n` +
          `No refund was issued. Any applicable release of funds to the seller ` +
          `is handled separately.`;

    if (transaction.buyerPhone) {
      await sendWhatsAppMessage(transaction.buyerPhone, resolutionMessage);
    }
    if (transaction.sellerPhone) {
      await sendWhatsAppMessage(transaction.sellerPhone, resolutionMessage);
    }

    await recordEvent({
      transactionId: transaction.id,
      transactionRef,
      type: EVENTS.DISPUTE_UPDATED,
      message: `Dispute resolved (${disputeFault})${
        refundSummary ? ` — refund ${refundSummary.id} requested` : ""
      }`,
      actorKind: "ADMIN",
      actorId: admin.id,
      metadata: {
        disputeFault,
        resolution: resolution ?? null,
        refundId: refundSummary?.id ?? null,
      },
    });

    // Audit the dispute resolution (real client IP + User-Agent).
    await recordAdminAction(request, {
      adminId: admin.id,
      action: "DISPUTE_RESOLVED",
      targetId: transaction.id,
      message: `Resolved dispute on ${transaction.transactionRef} (fault: ${disputeFault}). Resolution: ${resolution || "Not specified"}`,
      changes: {
        disputeFault,
        resolution: resolution || null,
        refundRequested: refundSummary,
      },
    });

    return NextResponse.json({
      success: true,
      message: refundSummary
        ? "Dispute resolved. A refund request was opened and requires finance approval and execution."
        : "Dispute resolved. No refund was issued.",
      refund: refundSummary,
      transaction: updated,
    });
  } catch (error: unknown) {
    if (error instanceof RefundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin resolve disputes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/admin-auth";
import { roleHasPermission } from "@/lib/rbac";
import { maskPhone, maskAccount } from "@/lib/mask";

/**
 * GET /api/admin/transactions/[id]
 *
 * Full administrative detail for one escrow: summary, REAL timeline (from
 * TransactionEvent rows only — never synthesised), webhook history (redacted),
 * disputes, refunds and payouts.
 *
 * Sensitive-field policy:
 *   * release PIN — only with `transactions:read_pin`.
 *   * full phone / bank account — only with `transactions:read_pii`.
 *   * webhook payloads — never returned raw; only a sanitised event summary.
 * Looked up by internal id OR transactionRef so both the table (id) and the
 * legacy links (ref) work.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "transactions:read");
    if (auth.error) return auth.error;
    const role = auth.admin.role;
    const canReadPii = roleHasPermission(role, "transactions:read_pii");
    const canReadPin = roleHasPermission(role, "transactions:read_pin");

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Transaction id is required" }, { status: 400 });
    }

    const transaction = await prisma.escrowTransaction.findFirst({
      where: { OR: [{ id }, { transactionRef: id }] },
      include: {
        buyer: { select: { id: true, name: true, phone: true } },
        seller: { select: { id: true, name: true, phone: true, bankName: true, bankCode: true, accountNumber: true } },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Related records (parallel).
    const [events, webhooks, disputes, refunds, payouts] = await Promise.all([
      prisma.transactionEvent.findMany({
        where: { transactionId: transaction.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.webhookLog.findMany({
        where: { transactionRef: transaction.transactionRef },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          provider: true,
          eventType: true,
          status: true,
          attemptCount: true,
          errorCategory: true,
          eventId: true,
          createdAt: true,
          processedAt: true,
        },
      }),
      prisma.dispute.findMany({
        where: { transactionId: transaction.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.refund.findMany({
        where: { transactionId: transaction.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payoutQueue.findMany({
        where: { transactionId: transaction.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      piiMasked: !canReadPii,
      pinVisible: canReadPin,
      transaction: {
        id: transaction.id,
        transactionRef: transaction.transactionRef,
        itemTitle: transaction.itemTitle,
        currency: transaction.currency,
        countryCode: transaction.countryCode,
        paymentProvider: transaction.paymentProvider,
        flwTransactionId: transaction.flwTransactionId,
        itemAmount: transaction.itemAmount,
        waybillAmount: transaction.waybillAmount,
        waybillPayer: transaction.waybillPayer,
        totalEscrow: transaction.totalEscrow,
        platformFee: transaction.platformFee,
        gatewayFee: transaction.gatewayFee,
        payoutAmount:
          transaction.totalEscrow - transaction.platformFee - transaction.gatewayFee,
        status: transaction.status,
        dispatchStatus: transaction.dispatchStatus,
        deliveryStatus: transaction.deliveryStatus,
        trackingNumber: transaction.trackingNumber,
        logisticsProvider: transaction.logisticsProvider,
        waybillUrl: transaction.waybillUrl,
        disputeFault: transaction.disputeFault,
        disputeStage: transaction.disputeStage,
        riskLevel: transaction.riskLevel,
        riskScore: transaction.riskScore,
        releasePin: canReadPin ? transaction.releasePin : undefined,
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
        buyer: {
          id: transaction.buyer.id,
          name: transaction.buyer.name,
          phone: canReadPii ? transaction.buyer.phone : maskPhone(transaction.buyer.phone),
        },
        seller: {
          id: transaction.seller.id,
          name: transaction.seller.name,
          phone: canReadPii ? transaction.seller.phone : maskPhone(transaction.seller.phone),
          bankName: transaction.seller.bankName,
          bankCode: transaction.seller.bankCode,
          accountNumber: canReadPii
            ? transaction.seller.accountNumber
            : maskAccount(transaction.seller.accountNumber),
        },
      },
      timeline: events.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        actorKind: e.actorKind,
        actorId: e.actorId,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
      })),
      webhooks: webhooks.map((w) => ({
        id: w.id,
        provider: w.provider,
        eventType: w.eventType,
        status: w.status,
        attemptCount: w.attemptCount,
        errorCategory: w.errorCategory,
        externalEventId: w.eventId,
        receivedAt: w.createdAt.toISOString(),
        processedAt: w.processedAt?.toISOString() ?? null,
      })),
      disputes: disputes.map((d) => ({
        id: d.id,
        category: d.category,
        description: d.description,
        status: d.status,
        assignedToId: d.assignedToId,
        resolution: d.resolution,
        openedByPhone: canReadPii ? d.openedByPhone : maskPhone(d.openedByPhone),
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      refunds: refunds.map((r) => ({
        id: r.id,
        amountMinor: r.amountMinor,
        amount: r.amountMinor / 100,
        currency: r.currency,
        reason: r.reason,
        status: r.status,
        processorRef: r.processorRef,
        failureReason: r.failureReason,
        requestedById: r.requestedById,
        reviewedById: r.reviewedById,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        retryCount: p.retryCount,
        errorMessage: p.errorMessage,
        providerRef: p.providerRef,
        processedAt: p.processedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Admin transaction detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

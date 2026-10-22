// lib/refunds/workflow.ts
//
// Refund workflow: the authoritative, server-side refund engine.
//
// WHY THIS EXISTS
// ---------------
// The legacy `/api/escrow/ref` route set `status = REFUNDED` and messaged both
// parties "Full amount will be returned to the buyer's original payment method"
// WITHOUT ever calling Flutterwave. It was a phantom refund: the ledger said the
// money was returned, the customer was told it was returned, and nothing moved.
//
// This module replaces that with a real lifecycle:
//
//   REQUESTED → UNDER_REVIEW → APPROVED → PROCESSING → COMPLETED
//                            ↘ REJECTED              ↘ FAILED
//
// Design rules:
//   1. Amounts are computed SERVER-SIDE from the escrow record, never from the
//      request body. A caller cannot inflate a refund.
//   2. `eligibleRefundMinor()` accounts for prior successful refunds, so the
//      cumulative refunded total can never exceed what was actually collected.
//   3. A refund is only COMPLETED after the provider confirms it. When the
//      escrow has no provider transaction id (manual funding), the workflow
//      stops at PROCESSING and is flagged as requiring manual settlement —
//      it never fabricates a provider success.
//   4. State transitions are validated; illegal transitions are structured
//      rejections, not silent no-ops.
//   5. Concurrency is handled by an atomic conditional update, exactly like
//      lib/payouts/processor.ts, so two concurrent approvals cannot both fire.

import { prisma } from "@/lib/prisma";
import {
  initiateFlutterwaveRefund,
  verifyFlutterwaveTransaction,
} from "@/lib/flutterwave";
import { isRefundEligible } from "@/lib/escrow-lifecycle";
import { recordEvent, EVENTS } from "@/lib/events";
import type { Refund, RefundStatus } from "@prisma/client";

/** Naira → kobo. */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

/** Kobo → naira. */
export function toMajor(amountMinor: number): number {
  return amountMinor / 100;
}

export class RefundError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

/** Refund statuses that still reserve funds (i.e. are "in flight"). */
const ACTIVE_REFUND_STATUSES: RefundStatus[] = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
];

/**
 * Server-authoritative refundable amount for an escrow, in integer minor units.
 *
 * The buyer was charged `totalEscrow`; escrow fees (`platformFee`, `gatewayFee`)
 * are non-refundable on a completed collection, so the refundable ceiling is the
 * item value (+ any buyer-paid waybill), matching what the seller would have
 * received. Prior successful refunds are subtracted so the *cumulative* refunded
 * total can never exceed the ceiling.
 *
 * Returns 0 when the escrow is not in a funded state.
 */
export async function eligibleRefundMinor(transactionId: string): Promise<number> {
  const tx = await prisma.escrowTransaction.findUnique({
    where: { id: transactionId },
    select: {
      status: true,
      totalEscrow: true,
      platformFee: true,
      gatewayFee: true,
    },
  });

  if (!tx) throw new RefundError("Transaction not found", 404);
  if (!isRefundEligible(tx.status)) return 0;

  const ceiling = toMinor(
    Math.max(0, tx.totalEscrow - tx.platformFee - tx.gatewayFee)
  );

  const prior = await prisma.refund.aggregate({
    where: {
      transactionId,
      status: { in: ["PROCESSING", "COMPLETED"] },
    },
    _sum: { amountMinor: true },
  });

  const already = prior._sum.amountMinor ?? 0;
  return Math.max(0, ceiling - already);
}

/** Create a refund REQUEST. Does not move money and does not change escrow status. */
export async function requestRefund(params: {
  transactionRef: string;
  amountMinor?: number;
  reason?: string;
  requestedById: string;
}): Promise<Refund> {
  const tx = await prisma.escrowTransaction.findUnique({
    where: { transactionRef: params.transactionRef },
    select: { id: true, transactionRef: true, status: true, currency: true },
  });

  if (!tx) throw new RefundError("Transaction not found", 404);

  if (!isRefundEligible(tx.status)) {
    throw new RefundError(
      `Transaction is ${tx.status}; only a funded escrow can be refunded.`,
      409
    );
  }

  const eligible = await eligibleRefundMinor(tx.id);
  if (eligible <= 0) {
    throw new RefundError(
      "No refundable amount remains on this transaction.",
      409
    );
  }

  const amountMinor = params.amountMinor ?? eligible;
  if (amountMinor <= 0) {
    throw new RefundError("Refund amount must be positive.", 400);
  }
  if (amountMinor > eligible) {
    throw new RefundError(
      `Refund amount exceeds the eligible ${toMajor(eligible)} ${tx.currency}.`,
      400
    );
  }

  // Idempotency: reject a duplicate outstanding request for the same escrow
  // with the same amount while one is still in flight.
  const existing = await prisma.refund.findFirst({
    where: {
      transactionId: tx.id,
      status: { in: ACTIVE_REFUND_STATUSES },
    },
  });
  if (existing) {
    return existing;
  }

  const created = await prisma.refund.create({
    data: {
      transactionId: tx.id,
      transactionRef: tx.transactionRef,
      amountMinor,
      currency: tx.currency,
      reason: params.reason ?? null,
      status: "REQUESTED",
      requestedById: params.requestedById,
    },
  });

  await recordRefundEvent(
    created,
    `Refund requested: ${toMajor(amountMinor)} ${tx.currency}`,
    params.requestedById,
    { reason: params.reason ?? null }
  );

  return created;
}

/** Fire-and-forget timeline event for a refund state change. Never throws. */
async function recordRefundEvent(
  refund: Pick<Refund, "transactionId" | "transactionRef" | "id" | "amountMinor" | "currency">,
  message: string,
  actorId?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordEvent({
    transactionId: refund.transactionId,
    transactionRef: refund.transactionRef,
    type: EVENTS.REFUND_REQUESTED,
    message,
    actorKind: actorId ? "ADMIN" : "SYSTEM",
    actorId: actorId ?? null,
    metadata: { refundId: refund.id, amountMinor: refund.amountMinor, currency: refund.currency, ...metadata },
  });
}

const PERMITTED_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  REQUESTED: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["PROCESSING", "REJECTED"],
  PROCESSING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [], // a retry creates a new request rather than reopening a failed one
  REJECTED: [],
};

/** True when `from → to` is a legal refund transition. */
export function canTransition(from: RefundStatus, to: RefundStatus): boolean {
  return PERMITTED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Move a refund to a new status, validating the transition. */
export async function transitionRefund(params: {
  refundId: string;
  to: RefundStatus;
  reviewedById: string;
  note?: string;
}): Promise<Refund> {
  const refund = await prisma.refund.findUnique({
    where: { id: params.refundId },
  });
  if (!refund) throw new RefundError("Refund not found", 404);

  if (!canTransition(refund.status, params.to)) {
    throw new RefundError(
      `Illegal refund transition ${refund.status} → ${params.to}.`,
      409
    );
  }

  return prisma.refund.update({
    where: { id: refund.id },
    data: {
      status: params.to,
      reviewedById: params.reviewedById,
      reviewedAt: new Date(),
      ...(params.to === "REJECTED" ? { failureReason: params.note ?? null } : {}),
      ...(params.to === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });
}

export interface ExecuteResult {
  ok: boolean;
  status: RefundStatus;
  /** Set when the provider confirmed the refund. */
  processorRef?: string;
  /** Human-readable explanation for a non-completed outcome. */
  message?: string;
}

/**
 * Execute an APPROVED refund against the provider.
 *
 * Concurrency: the APPROVED → PROCESSING transition is taken with an atomic
 * conditional `updateMany`, so exactly one caller can move a given refund into
 * PROCESSING. A concurrent second call finds `count: 0` and is rejected.
 *
 * Provider confirmation: the refund is only COMPLETED once Flutterwave accepts
 * it. If the escrow has no `flwTransactionId` there is nothing to refund
 * against programmatically, so the refund stays PROCESSING and the caller is
 * told manual settlement is required — no phantom success.
 */
export async function executeRefund(params: {
  refundId: string;
  actorId: string;
}): Promise<ExecuteResult> {
  const refund = await prisma.refund.findUnique({
    where: { id: params.refundId },
    include: { transaction: true },
  });
  if (!refund) throw new RefundError("Refund not found", 404);

  if (refund.status !== "APPROVED") {
    throw new RefundError(
      `Refund is ${refund.status}; only an APPROVED refund can be executed.`,
      409
    );
  }

  // Re-validate the amount against the live escrow — an approval made before a
  // concurrent refund/release must not over-refund.
  const eligible = await eligibleRefundMinor(refund.transactionId);
  if (refund.amountMinor > eligible) {
    throw new RefundError(
      `Refund of ${toMajor(refund.amountMinor)} exceeds the currently eligible ${toMajor(
        eligible
      )} ${refund.currency}; re-review required.`,
      409
    );
  }

  // Atomically claim: APPROVED → PROCESSING.
  const claim = await prisma.refund.updateMany({
    where: { id: refund.id, status: "APPROVED" },
    data: {
      status: "PROCESSING",
      reviewedById: params.actorId,
    },
  });
  if (claim.count === 0) {
    throw new RefundError("Refund execution already in progress.", 409);
  }

  const flwTxnId = refund.transaction.flwTransactionId;

  // No provider transaction id → cannot refund programmatically. Keep the row
  // PROCESSING and flag it for manual settlement rather than faking success.
  if (!flwTxnId) {
    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        failureReason:
          "No provider transaction id on file — refund requires manual settlement.",
      },
    });
    return {
      ok: false,
      status: "PROCESSING",
      message:
        "No Flutterwave transaction id is recorded for this escrow, so the refund could not be executed automatically. The refund remains PROCESSING pending manual settlement.",
    };
  }

  const processorRef = `TS-REFUND-${refund.transactionRef}-${Date.now()}`;

  try {
    const result = await initiateFlutterwaveRefund({
      transactionId: flwTxnId,
      amount: toMajor(refund.amountMinor),
      comments: `TrustShip refund ${processorRef}`,
    });

    const completed = /success|completed/i.test(result.status);

    if (!completed) {
      await prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: "FAILED",
          processorRef,
          failureReason: `Provider returned status "${result.status}".`,
        },
      });
      return {
        ok: false,
        status: "FAILED",
        processorRef,
        message: `Provider did not confirm the refund (status "${result.status}").`,
      };
    }

    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: "COMPLETED", processorRef, completedAt: new Date() },
    });

    await recordEvent({
      transactionId: refund.transactionId,
      transactionRef: refund.transactionRef,
      type: EVENTS.REFUND_COMPLETED,
      message: `Refund completed: ${toMajor(refund.amountMinor)} ${refund.currency} (${processorRef})`,
      actorKind: "ADMIN",
      actorId: params.actorId,
      metadata: {
        refundId: refund.id,
        amountMinor: refund.amountMinor,
        processorRef,
      },
    });

    return { ok: true, status: "COMPLETED", processorRef };
  } catch (error: any) {
    // Transport/provider error: record FAILED so an operator can re-request.
    await prisma.refund
      .update({
        where: { id: refund.id },
        data: {
          status: "FAILED",
          failureReason:
            error?.response?.data?.message ?? error?.message ?? "Provider error",
        },
      })
      .catch(() => {});
    return {
      ok: false,
      status: "FAILED",
      message: "The payment provider rejected or could not process the refund.",
    };
  }
}

/**
 * Best-effort independent verification of a captured provider transaction id
 * before a refund is executed. Returns true when the provider agrees the
 * transaction is successful and the amount matches the escrow total.
 */
export async function verifySettlement(transactionId: string): Promise<boolean> {
  const tx = await prisma.escrowTransaction.findUnique({
    where: { id: transactionId },
    select: { flwTransactionId: true, totalEscrow: true },
  });
  if (!tx?.flwTransactionId) return false;

  try {
    const verified = await verifyFlutterwaveTransaction(tx.flwTransactionId);
    if (!verified) return false;
    return (
      /success/i.test(verified.status) &&
      Math.abs(verified.amount - tx.totalEscrow) < 0.01
    );
  } catch {
    // Provider unreachable — do not block; the refund path re-validates amounts.
    return false;
  }
}

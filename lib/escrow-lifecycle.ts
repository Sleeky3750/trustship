// lib/escrow-lifecycle.ts
//
// Canonical escrow state machine + atomic release claim.
//
// WHY THIS EXISTS
// ---------------
// Three separate routes (escrow/release, admin/release, admin/escrow/[ref]/release)
// each implemented their own idea of "can I release this?" — all of them checking
// only `status === COMPLETED` and none checking whether the escrow was ever
// FUNDED. That allowed:
//   * releasing an escrow still in PENDING_DEPOSIT (money the buyer never paid), and
//   * a TOCTOU double-payout: two concurrent requests both read COMPLETED=false,
//     both pass, both call Flutterwave.
//
// The fix has two halves:
//   1. `RELEASABLE_STATUSES` — only a funded+delivered escrow may be released.
//   2. `claimRelease()` — an atomic conditional UPDATE that flips the row into a
//      terminal "release in progress" state BEFORE the provider call. Exactly one
//      concurrent caller can win the claim; the loser is told to stop.
//
// The claim is deliberately conservative: if the provider call subsequently
// fails, `releaseClaim()` rolls the claim back so a legitimate retry can proceed.

import { prisma } from "@/lib/prisma";
import type { TransactionStatus } from "@prisma/client";

/**
 * Statuses from which a seller payout is legitimate.
 *
 * - DISPATCHED / DELIVERED: the normal path (seller shipped, buyer received).
 * - ESCROW_LOCKED: admin overrides for cases resolved without a formal delivery
 *   step (e.g. a settled dispute favouring the seller). Kept deliberately narrow.
 *
 * PENDING_* is intentionally absent: no funds exist yet, so nothing can be paid.
 * DISPUTE_OPEN is absent: an active dispute must be resolved first (the dispute
 * resolution path moves the escrow to a releasable state as part of its outcome).
 */
export const RELEASABLE_STATUSES: TransactionStatus[] = [
  "DISPATCHED",
  "DELIVERED",
  "ESCROW_LOCKED",
];

/** Sentinel used to reserve a release before the provider call completes. */
const RELEASE_IN_PROGRESS: TransactionStatus = "COMPLETED";

export interface ReleaseClaim {
  ok: boolean;
  /** Populated when `ok` is false. */
  reason?: string;
  /** Status observed before the claim (for audit/rollback). */
  previousStatus?: TransactionStatus;
}

/**
 * Atomically claim the right to release an escrow.
 *
 * Uses `updateMany` with a WHERE that requires a releasable status, so the
 * database itself serialises concurrent attempts: the first caller flips the
 * row, every subsequent caller's WHERE no longer matches and gets `count: 0`.
 *
 * NOTE: the row is set to COMPLETED here as the "claimed" marker (the same
 * terminal state the old code used), which means a crash between claim and
 * provider call leaves the escrow looking released. That is the SAFE direction
 * for money (no double pay); the audit row records the attempt and an operator
 * can reconcile. `releaseClaim()` exists for the *provider-rejected* case,
 * which is detectable and should be retryable.
 */
export async function claimRelease(transactionId: string): Promise<ReleaseClaim> {
  const current = await prisma.escrowTransaction.findUnique({
    where: { id: transactionId },
    select: { status: true },
  });

  if (!current) {
    return { ok: false, reason: "Transaction not found" };
  }

  if (!RELEASABLE_STATUSES.includes(current.status)) {
    return {
      ok: false,
      reason: `Transaction is ${current.status}; only a funded, delivered escrow can be released.`,
      previousStatus: current.status,
    };
  }

  const claim = await prisma.escrowTransaction.updateMany({
    where: { id: transactionId, status: { in: RELEASABLE_STATUSES } },
    data: { status: RELEASE_IN_PROGRESS },
  });

  if (claim.count === 0) {
    return {
      ok: false,
      reason: "Release already in progress or completed for this transaction.",
      previousStatus: current.status,
    };
  }

  return { ok: true, previousStatus: current.status };
}

/**
 * Roll back a release claim after the provider rejected the transfer, restoring
 * the pre-claim status so an operator can retry. Never called on success.
 */
export async function releaseClaim(
  transactionId: string,
  previousStatus: TransactionStatus
): Promise<void> {
  await prisma.escrowTransaction.update({
    where: { id: transactionId },
    data: { status: previousStatus },
  });
}

/** Human-readable status label for the admin UI. */
export const STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING_SELLER_ACCEPTANCE: "Awaiting Seller Acceptance",
  PENDING_PAYMENT: "Awaiting Payment",
  PENDING_AGREEMENT: "Awaiting Agreement",
  PENDING_DEPOSIT: "Awaiting Deposit",
  ESCROW_LOCKED: "Escrow Funded",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  DISPUTE_OPEN: "Dispute Open",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

/**
 * Terminal states — no further lifecycle transitions are expected.
 * `COMPLETED` and `REFUNDED` are financial terminals; `CANCELLED` is a
 * non-financial terminal.
 */
export const TERMINAL_STATUSES: TransactionStatus[] = [
  "COMPLETED",
  "REFUNDED",
  "CANCELLED",
];

/** True when the escrow holds money that must be reconciled (i.e. was funded). */
export const FUNDED_STATUSES: TransactionStatus[] = [
  "ESCROW_LOCKED",
  "DISPATCHED",
  "DELIVERED",
  "DISPUTE_OPEN",
];

/**
 * Record the timeline events for a completed seller release. Called by every
 * release path (web PIN release, admin release, per-action release) so the
 * transaction timeline is consistent regardless of entry point. Never throws.
 */
export async function recordReleaseEvents(params: {
  transactionId: string;
  transactionRef: string;
  actorId?: string | null;
  actorKind?: "ADMIN" | "SYSTEM";
  payoutAmount: number;
  payoutReference: string;
  fromStatus?: TransactionStatus;
}): Promise<void> {
  const { recordEvent, EVENTS } = await import("@/lib/events");
  await recordEvent({
    transactionId: params.transactionId,
    transactionRef: params.transactionRef,
    type: EVENTS.RELEASE_COMPLETED,
    message: `Funds released to seller: ₦${params.payoutAmount.toLocaleString()} (${params.payoutReference})`,
    actorKind: params.actorKind ?? "ADMIN",
    actorId: params.actorId ?? null,
    metadata: {
      payoutAmount: params.payoutAmount,
      payoutReference: params.payoutReference,
      from: params.fromStatus ?? null,
      to: "COMPLETED",
    },
  });
  await recordEvent({
    transactionId: params.transactionId,
    transactionRef: params.transactionRef,
    type: EVENTS.COMPLETED,
    message: "Transaction completed",
    actorKind: "SYSTEM",
    metadata: { to: "COMPLETED" },
  });
}

/**
 * A refund is only eligible if the escrow actually collected money and has not
 * already been paid out. This is the server-authoritative eligibility rule —
 * callers must never compute it from client input.
 */
export function isRefundEligible(status: TransactionStatus): boolean {
  return FUNDED_STATUSES.includes(status);
}

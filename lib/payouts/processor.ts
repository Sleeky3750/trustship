// lib/payouts/processor.ts
//
// Automated payout execution (worker stub).
//
// This is the seam a cron/queue worker will call once Flutterwave Transfers
// is live. It is deliberately IDEMPOTENT and SAFE-BY-DEFAULT:
//
//   1. A `PayoutQueue` row is the unit of work. Its `providerRef` is a unique,
//      deterministically-derived reference so a replayed run cannot mint a
//      second transfer for the same attempt.
//   2. Only PENDING/FAILED rows are claimed — SUCCESS is terminal, and a row
//      already PROCESSING is left alone (another worker holds it).
//   3. Claiming uses a conditional `updateMany` (WHERE status=...) so two
//      concurrent workers cannot both take the same row.
//   4. The balance invariant from lib/payout.ts is re-checked before sending:
//      we never transfer an amount the escrow did not actually collect.
//
// The network call itself is stubbed behind `executeTransfer` so this module
// is fully testable without Flutterwave credentials.

import { prisma } from "@/lib/prisma";
import { initiateFlutterwaveTransfer } from "@/lib/flutterwave";
import { computePayoutAmount } from "@/lib/payout";
import type { PayoutStatus } from "@prisma/client";

/** Build the unique provider reference for a payout attempt. */
export function buildPayoutReference(transactionRef: string, retryCount: number): string {
  return `TS-PAYOUT-${transactionRef}-${retryCount}`;
}

export interface EnqueuePayoutInput {
  transactionRef: string;
  amount: number;
  accountNumber: string;
  bankCode: string;
}

export interface ProcessResult {
  payoutId: string;
  status: PayoutStatus;
  providerRef: string | null;
  error?: string;
}

/**
 * Queue a payout for an escrow release.
 *
 * Idempotent by transactionRef + status: if an active (PENDING/PROCESSING) or
 * successful payout already exists for this transaction, the existing row is
 * returned instead of creating a duplicate. A previously FAILED payout is
 * re-queued by resetting it to PENDING rather than inserting a new row.
 */
export async function enqueuePayout(input: EnqueuePayoutInput) {
  const transaction = await prisma.escrowTransaction.findUnique({
    where: { transactionRef: input.transactionRef },
  });

  if (!transaction) {
    throw new Error(`Transaction not found: ${input.transactionRef}`);
  }

  const existing = await prisma.payoutQueue.findFirst({
    where: { transactionId: transaction.id, status: { in: ["PENDING", "PROCESSING", "SUCCESS"] } },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return { created: false, payout: existing };
  }

  // Reuse the most recent failed attempt if present, so `retryCount` is the
  // single source of truth for how many times we have tried.
  const failed = await prisma.payoutQueue.findFirst({
    where: { transactionId: transaction.id, status: "FAILED" },
    orderBy: { createdAt: "desc" },
  });

  if (failed) {
    const requeued = await prisma.payoutQueue.update({
      where: { id: failed.id },
      data: {
        status: "PENDING",
        errorMessage: null,
        accountNumber: input.accountNumber,
        bankCode: input.bankCode,
      },
    });
    return { created: false, payout: requeued };
  }

  const created = await prisma.payoutQueue.create({
    data: {
      transactionId: transaction.id,
      transactionRef: transaction.transactionRef,
      amount: input.amount,
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      status: "PENDING",
      providerRef: buildPayoutReference(transaction.transactionRef, 0),
    },
  });

  return { created: true, payout: created };
}

/** The actual transfer call. Isolated so tests can stub it. */
async function executeTransfer(params: {
  payoutId: string;
  transactionRef: string;
  amount: number;
  accountNumber: string;
  bankCode: string;
  beneficiaryName: string;
  providerRef: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await initiateFlutterwaveTransfer({
      reference: params.providerRef,
      amount: params.amount,
      accountNumber: params.accountNumber,
      accountBank: params.bankCode,
      beneficiaryName: params.beneficiaryName,
      narration: `TrustShip escrow payout ${params.transactionRef}`,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Transfer failed",
    };
  }
}

/**
 * Process a single payout row.
 *
 * Claims the row atomically, re-validates the payout amount against the escrow,
 * executes the transfer and records the terminal state. Never throws for a
 * routine failure — it records FAILED on the row and returns the outcome, so a
 * batch worker can keep going.
 */
export async function processPayout(payoutId: string): Promise<ProcessResult> {
  const payout = await prisma.payoutQueue.findUnique({
    where: { id: payoutId },
    include: { transaction: { include: { seller: { select: { name: true } } } } },
  });

  if (!payout) {
    return { payoutId, status: "FAILED", providerRef: null, error: "Payout not found" };
  }

  if (payout.status === "SUCCESS") {
    return { payoutId, status: "SUCCESS", providerRef: payout.providerRef };
  }

  // Atomic claim: only a PENDING/FAILED row in the expected state transitions,
  // so concurrent workers cannot double-process the same payout.
  const claim = await prisma.payoutQueue.updateMany({
    where: { id: payoutId, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "PROCESSING" },
  });

  if (claim.count === 0) {
    const current = await prisma.payoutQueue.findUnique({ where: { id: payoutId } });
    return {
      payoutId,
      status: current?.status ?? "PROCESSING",
      providerRef: current?.providerRef ?? null,
      error: "Payout is already being processed",
    };
  }

  const providerRef =
    payout.providerRef ?? buildPayoutReference(payout.transactionRef, payout.retryCount);

  // Balance invariant: the payout must equal the escrow's computed payout. A
  // mismatch means the row was tampered with or the fee schedule changed —
  // refuse rather than send the wrong amount.
  const expected = computePayoutAmount({
    totalEscrow: payout.transaction.totalEscrow,
    platformFee: payout.transaction.platformFee,
    gatewayFee: payout.transaction.gatewayFee,
  });

  if (Math.abs(expected - payout.amount) > 0.01) {
    const message = `Amount mismatch: queued ${payout.amount} but escrow permits ${expected}`;
    await prisma.payoutQueue.update({
      where: { id: payoutId },
      data: { status: "FAILED", errorMessage: message, providerRef },
    });
    return { payoutId, status: "FAILED", providerRef, error: message };
  }

  const result = await executeTransfer({
    payoutId,
    transactionRef: payout.transactionRef,
    amount: payout.amount,
    accountNumber: payout.accountNumber,
    bankCode: payout.bankCode,
    // Prefer the verified account name captured at onboarding; fall back to the
    // seller's stored name so the provider always receives a beneficiary.
    beneficiaryName: payout.transaction.seller?.name || "TrustShip seller",
    providerRef,
  });

  if (result.ok) {
    await prisma.payoutQueue.update({
      where: { id: payoutId },
      data: {
        status: "SUCCESS",
        errorMessage: null,
        processedAt: new Date(),
        providerRef,
      },
    });
    return { payoutId, status: "SUCCESS", providerRef };
  }

  await prisma.payoutQueue.update({
    where: { id: payoutId },
    data: { status: "FAILED", errorMessage: result.error, providerRef },
  });
  return { payoutId, status: "FAILED", providerRef, error: result.error };
}

/**
 * Retry a failed payout by minting the next attempt.
 *
 * Bumps `retryCount` and derives a NEW providerRef (attempt N+1), which is what
 * makes the retry idempotent: attempt 0's reference can never be reused, so a
 * partial provider-side success cannot be duplicated.
 */
export async function retryPayout(payoutId: string): Promise<ProcessResult> {
  const payout = await prisma.payoutQueue.findUnique({ where: { id: payoutId } });
  if (!payout) {
    return { payoutId, status: "FAILED", providerRef: null, error: "Payout not found" };
  }

  if (payout.status === "SUCCESS") {
    return { payoutId, status: "SUCCESS", providerRef: payout.providerRef, error: "Payout already succeeded" };
  }

  const nextRetry = payout.retryCount + 1;
  const providerRef = buildPayoutReference(payout.transactionRef, nextRetry);

  await prisma.payoutQueue.update({
    where: { id: payoutId },
    data: {
      status: "PENDING",
      retryCount: nextRetry,
      errorMessage: null,
      providerRef,
    },
  });

  return processPayout(payoutId);
}

/** Drain the queue (bounded). Used by the cron endpoint. */
export async function processPendingPayouts(limit = 25): Promise<ProcessResult[]> {
  const pending = await prisma.payoutQueue.findMany({
    where: { status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const results: ProcessResult[] = [];
  for (const row of pending) {
    results.push(await processPayout(row.id));
  }
  return results;
}

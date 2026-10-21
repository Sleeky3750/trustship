// lib/disputes/index.ts
//
// Dispute case loader + transition helper.
//
// `loadDisputeCase` assembles everything the moderation board renders in a
// single round trip (transaction, both statements, evidence, audit trail).
// `advanceDisputeStage` is the ONLY write path for stage changes: it validates
// through transitions.ts, persists, and reports back a structured result.
import { prisma } from "@/lib/prisma";
import type { DisputeFault, DisputeStage } from "@prisma/client";
import { validateTransition, type TransitionActor, type TransitionResult } from "./transitions";

export * from "./transitions";

export interface DisputeCase {
  transactionId: string;
  transactionRef: string;
  stage: DisputeStage;
  status: string;
  disputeFault: DisputeFault | null;
  itemTitle: string | null;
  itemAmount: number;
  currency: string;
  totalEscrow: number;
  buyerPhone: string;
  sellerPhone: string;
  createdAt: string;
  updatedAt: string;
  evidence: {
    id: string;
    kind: string;
    caption: string | null;
    uploaderPhone: string;
    whatsappMediaId: string;
    mimeType: string | null;
    createdAt: string;
  }[];
  /** Buyer vs seller statements, side by side on the board. */
  statements: {
    buyer: string | null;
    seller: string | null;
  };
}

/**
 * Load a dispute case by transaction reference or id.
 * Returns null when the transaction does not exist; a transaction that is not
 * in DISPUTE_OPEN still loads (admins need the history) but `stage` defaults to
 * AWAITING_EVIDENCE when unset.
 */
export async function loadDisputeCase(
  identifier: { ref?: string; id?: string }
): Promise<DisputeCase | null> {
  const transaction = identifier.ref
    ? await prisma.escrowTransaction.findUnique({
        where: { transactionRef: identifier.ref },
        include: { disputeEvidence: { orderBy: { createdAt: "desc" } } },
      })
    : identifier.id
      ? await prisma.escrowTransaction.findUnique({
          where: { id: identifier.id },
          include: { disputeEvidence: { orderBy: { createdAt: "desc" } } },
        })
      : null;

  if (!transaction) return null;

  // Statements are recorded as audit rows (DISPUTE_OPEN carries the opener's
  // reason); the board reads the most recent per party.
  const auditRows = await prisma.adminAuditLog.findMany({
    where: { targetId: transaction.transactionRef },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const statementFor = (needle: string) => {
    const row = auditRows.find((r) => (r.details || "").includes(needle));
    if (!row?.details) return null;
    try {
      const parsed = JSON.parse(row.details);
      return (
        parsed.reason ||
        parsed.resolution ||
        parsed.message ||
        row.details ||
        null
      );
    } catch {
      return row.details;
    }
  };

  return {
    transactionId: transaction.id,
    transactionRef: transaction.transactionRef,
    stage: transaction.disputeStage ?? "AWAITING_EVIDENCE",
    status: transaction.status,
    disputeFault: transaction.disputeFault,
    itemTitle: transaction.itemTitle,
    itemAmount: transaction.itemAmount,
    currency: transaction.currency,
    totalEscrow: transaction.totalEscrow,
    buyerPhone: transaction.buyerPhone,
    sellerPhone: transaction.sellerPhone,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    evidence: transaction.disputeEvidence.map((e) => ({
      id: e.id,
      kind: e.kind,
      caption: e.caption,
      uploaderPhone: e.uploaderPhone,
      whatsappMediaId: e.whatsappMediaId,
      mimeType: e.mimeType,
      createdAt: e.createdAt.toISOString(),
    })),
    statements: {
      buyer: statementFor(transaction.buyerPhone) || statementFor("BUYER"),
      seller: statementFor(transaction.sellerPhone) || statementFor("SELLER"),
    },
  };
}

export interface AdvanceStageInput {
  transactionRef: string;
  toStage: DisputeStage;
  actor: TransitionActor;
  reason?: string;
  fault?: DisputeFault;
}

export interface AdvanceStageOutcome extends TransitionResult {
  /** Present only when the transition succeeded. */
  case?: DisputeCase;
}

/**
 * Advance a dispute through the moderation pipeline.
 *
 * Validation is the single source of truth in transitions.ts; this function
 * only supplies the database facts (current stage, evidence count) and
 * persists an accepted transition. Nothing here trusts caller-supplied stage
 * history.
 */
export async function advanceDisputeStage(
  input: AdvanceStageInput
): Promise<AdvanceStageOutcome> {
  const transaction = await prisma.escrowTransaction.findUnique({
    where: { transactionRef: input.transactionRef },
    include: { _count: { select: { disputeEvidence: true } } },
  });

  if (!transaction) {
    return { allowed: false, error: "Transaction not found." };
  }

  const evidenceCount = transaction._count.disputeEvidence;

  const validation = validateTransition(transaction.disputeStage, input.toStage, {
    actor: input.actor,
    evidenceCount,
    reason: input.reason,
    fault: input.fault,
  });

  if (!validation.allowed || !validation.nextStage) {
    return validation;
  }

  await prisma.escrowTransaction.update({
    where: { id: transaction.id },
    data: {
      disputeStage: validation.nextStage,
      // RESOLVED also records the fault allocation on the transaction itself so
      // the payout/refund handler has a single field to read.
      ...(validation.nextStage === "RESOLVED" && input.fault
        ? { disputeFault: input.fault }
        : {}),
    },
  });

  const updated = await loadDisputeCase({ ref: input.transactionRef });
  return { allowed: true, nextStage: validation.nextStage, case: updated ?? undefined };
}

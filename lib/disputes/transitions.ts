// lib/disputes/transitions.ts
//
// Multi-stage dispute resolution state machine.
//
// The dispute pipeline is deliberately separate from `TransactionStatus`:
// opening a dispute sets the transaction to DISPUTE_OPEN, while `disputeStage`
// tracks *where in moderation* the case sits. That separation means an escrow
// can sit in DISPUTE_OPEN across many stage changes without the transaction
// status flapping.
//
//   AWAITING_EVIDENCE ──▶ IN_MEDIATION ──▶ ARBITRATION_PENDING ──▶ RESOLVED
//          │                    │                    │
//          └────────────────────┴────────────────────┘
//                  (RESOLVED is reachable from any open stage —
//                   an early settlement is always allowed)
//
// Every transition is validated here, never in the UI, and callers receive a
// structured rejection instead of a thrown error so an API route can map it to
// a 4xx without a try/catch dance.

import type { DisputeStage } from "@prisma/client";

export type TransitionActor = "BUYER" | "SELLER" | "ADMIN" | "SYSTEM";

export interface TransitionContext {
  actor: TransitionActor;
  /** Number of evidence items on file — gates AWAITING_EVIDENCE → IN_MEDIATION. */
  evidenceCount?: number;
  /** Admin-provided reason, required for arbitration escalation / resolution. */
  reason?: string;
  /** Fault allocation, required to RESOLVE (who the funds favour). */
  fault?: "SELLER_FAULT" | "BUYER_FAULT";
}

export interface TransitionResult {
  allowed: boolean;
  /** Populated when `allowed` is true. */
  nextStage?: DisputeStage;
  /** Human readable reason when `allowed` is false. */
  error?: string;
}

/** The canonical ordered pipeline (RESOLVED is terminal, handled separately). */
export const DISPUTE_PIPELINE: DisputeStage[] = [
  "AWAITING_EVIDENCE",
  "IN_MEDIATION",
  "ARBITRATION_PENDING",
  "RESOLVED",
];

export const TERMINAL_DISPUTE_STAGES: DisputeStage[] = ["RESOLVED"];

export const STAGE_LABELS: Record<DisputeStage, string> = {
  AWAITING_EVIDENCE: "Awaiting Evidence",
  IN_MEDIATION: "In Mediation",
  ARBITRATION_PENDING: "Arbitration Pending",
  RESOLVED: "Resolved",
};

/**
 * Which responders may act on a given stage.
 *
 * Evidence collection is bilateral. Mediation and arbitration are admin-only —
 * a disputing party must never advance their own case past evidence gathering.
 */
const STAGE_ACTORS: Record<DisputeStage, TransitionActor[]> = {
  AWAITING_EVIDENCE: ["BUYER", "SELLER", "ADMIN", "SYSTEM"],
  IN_MEDIATION: ["ADMIN", "SYSTEM"],
  ARBITRATION_PENDING: ["ADMIN", "SYSTEM"],
  RESOLVED: [],
};

/** Minimum evidence items required before a case can leave evidence gathering. */
export const MIN_EVIDENCE_TO_MEDIATE = 1;

export function isTerminalStage(stage: DisputeStage | null | undefined): boolean {
  return !!stage && TERMINAL_DISPUTE_STAGES.includes(stage);
}

/**
 * Validate a proposed stage change.
 *
 * Rules:
 *  1. A RESOLVED case is immutable — reopening requires a new dispute.
 *  2. You cannot "stay" in the same stage (no no-op writes).
 *  3. You cannot skip backwards except straight to RESOLVED (settlement).
 *  4. Only admins/system may move a case beyond evidence gathering.
 *  5. AWAITING_EVIDENCE → IN_MEDIATION needs at least one evidence item.
 *  6. RESOLVED requires an explicit fault allocation and a reason.
 *  7. ARBITRATION_PENDING requires a reason (the escalation rationale).
 */
export function validateTransition(
  from: DisputeStage | null | undefined,
  to: DisputeStage,
  context: TransitionContext
): TransitionResult {
  const current = from ?? "AWAITING_EVIDENCE";

  if (isTerminalStage(current)) {
    return {
      allowed: false,
      error: "This dispute is already resolved and cannot be reopened.",
    };
  }

  if (current === to) {
    return { allowed: false, error: `The dispute is already in ${STAGE_LABELS[to]}.` };
  }

  const allowedActors = STAGE_ACTORS[current] ?? [];
  if (!allowedActors.includes(context.actor)) {
    return {
      allowed: false,
      error: `A ${context.actor.toLowerCase()} cannot change the dispute at this stage.`,
    };
  }

  // Escalation beyond evidence gathering is admin-only.
  if (to !== "RESOLVED" && current === "AWAITING_EVIDENCE" && !["ADMIN", "SYSTEM"].includes(context.actor)) {
    return {
      allowed: false,
      error: "Only a mediator can move the dispute to mediation.",
    };
  }

  // Forward-only, except the always-available settlement jump to RESOLVED.
  const currentIndex = DISPUTE_PIPELINE.indexOf(current);
  const targetIndex = DISPUTE_PIPELINE.indexOf(to);
  if (to !== "RESOLVED" && targetIndex < currentIndex) {
    return {
      allowed: false,
      error: `Cannot move a dispute backwards from ${STAGE_LABELS[current]} to ${STAGE_LABELS[to]}.`,
    };
  }

  switch (to) {
    case "IN_MEDIATION": {
      const evidence = context.evidenceCount ?? 0;
      if (evidence < MIN_EVIDENCE_TO_MEDIATE) {
        return {
          allowed: false,
          error: `At least ${MIN_EVIDENCE_TO_MEDIATE} piece(s) of evidence is required before mediation.`,
        };
      }
      return { allowed: true, nextStage: to };
    }

    case "ARBITRATION_PENDING": {
      if (!context.reason || !context.reason.trim()) {
        return {
          allowed: false,
          error: "An escalation reason is required for arbitration.",
        };
      }
      return { allowed: true, nextStage: to };
    }

    case "RESOLVED": {
      if (!context.fault) {
        return {
          allowed: false,
          error: "A fault allocation (seller or buyer) is required to resolve the dispute.",
        };
      }
      if (!context.reason || !context.reason.trim()) {
        return {
          allowed: false,
          error: "A resolution summary is required to close the dispute.",
        };
      }
      return { allowed: true, nextStage: to };
    }

    default:
      return { allowed: false, error: `Unknown dispute stage: ${to}` };
  }
}

/**
 * Evidence submission guard. Any party may submit while evidence is being
 * gathered; a resolved case accepts nothing further.
 */
export function validateEvidenceSubmission(
  stage: DisputeStage | null | undefined,
  submitter: TransitionActor
): TransitionResult {
  if (isTerminalStage(stage)) {
    return {
      allowed: false,
      error: "This dispute is resolved — evidence can no longer be submitted.",
    };
  }
  if (submitter === "ADMIN" || submitter === "SYSTEM") {
    return { allowed: true };
  }
  return { allowed: true };
}

/** Stages a case may advance to from `stage` (drives the admin action bar). */
export function availableTransitions(stage: DisputeStage): DisputeStage[] {
  if (isTerminalStage(stage)) return [];
  if (stage === "AWAITING_EVIDENCE") {
    return ["IN_MEDIATION", "ARBITRATION_PENDING", "RESOLVED"];
  }
  if (stage === "IN_MEDIATION") {
    return ["ARBITRATION_PENDING", "RESOLVED"];
  }
  return ["RESOLVED"];
}

// lib/risk/evaluator.ts
//
// Fraud risk scoring.
//
// Produces a 0–100 score plus a LOW / MEDIUM / HIGH band from signals that are
// all derivable from data TrustShip already holds. The weighting is a
// transparent additive model — not a black box — so an admin reviewing a
// flagged transaction can see exactly why it scored the way it did.
//
// Signals (each contributes a bounded number of points):
//   - Transaction amount vs. the platform's typical range
//   - Buyer account age (brand-new accounts are higher risk)
//   - Prior disputes on this buyer/seller, and their dispute ratio
//   - Repeat counterparty pairing (a fresh pair is riskier than a repeat one)
//   - Velocity: many transactions created in a short window
//   - Missing/unverified payout bank details
//
// The score is advisory: it flags for human review, it never blocks a
// transaction on its own.

import { prisma } from "@/lib/prisma";
import type { RiskLevel } from "@prisma/client";

export interface RiskSignal {
  code: string;
  /** Points contributed (can be negative for trust signals). */
  score: number;
  detail: string;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
  /** Short human-readable explanation for the badge tooltip. */
  summary: string;
  evaluatedAt: string;
}

/** Band thresholds. `HIGH` at 70+ keeps a meaningful review queue. */
export const RISK_THRESHOLDS = { MEDIUM: 35, HIGH: 70 } as const;

/** Amount thresholds (in the transaction currency) used for the size signal. */
export const HIGH_VALUE_THRESHOLD = 500_000;
export const ELEVATED_VALUE_THRESHOLD = 200_000;

export function bandFor(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.HIGH) return "HIGH";
  if (score >= RISK_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

export interface EvaluateInput {
  /** Score a persisted transaction by reference. */
  transactionRef?: string;
  /** Or score a prospective one (used at creation time). */
  amount?: number;
  buyerPhone?: string;
  sellerPhone?: string;
}

/**
 * Evaluate the fraud risk of a transaction.
 *
 * Returns null when the reference does not exist; otherwise always returns an
 * assessment (never throws for missing optional data — a missing signal simply
 * contributes no points).
 */
export async function evaluateRisk(input: EvaluateInput): Promise<RiskAssessment | null> {
  let amount = input.amount ?? 0;
  let buyerPhone = input.buyerPhone ?? "";
  let sellerPhone = input.sellerPhone ?? "";
  let transactionId: string | null = null;

  if (input.transactionRef) {
    const transaction = await prisma.escrowTransaction.findUnique({
      where: { transactionRef: input.transactionRef },
      select: { id: true, itemAmount: true, buyerPhone: true, sellerPhone: true },
    });
    if (!transaction) return null;
    transactionId = transaction.id;
    amount = transaction.itemAmount;
    buyerPhone = transaction.buyerPhone;
    sellerPhone = transaction.sellerPhone;
  }

  const signals: RiskSignal[] = [];

  // --- 1. Transaction size ------------------------------------------------
  if (amount >= HIGH_VALUE_THRESHOLD) {
    signals.push({
      code: "HIGH_VALUE",
      score: 25,
      detail: `High-value transaction (${amount.toLocaleString()})`,
    });
  } else if (amount >= ELEVATED_VALUE_THRESHOLD) {
    signals.push({
      code: "ELEVATED_VALUE",
      score: 12,
      detail: `Elevated transaction value (${amount.toLocaleString()})`,
    });
  } else if (amount > 0 && amount < 2_000) {
    signals.push({
      code: "MICRO_VALUE",
      score: 5,
      detail: "Very small transaction (possible test charge)",
    });
  }

  // --- 2. Account history -------------------------------------------------
  const [buyer, seller] = await Promise.all([
    buyerPhone
      ? prisma.user.findUnique({
          where: { phone: buyerPhone },
          select: { createdAt: true },
        })
      : null,
    sellerPhone
      ? prisma.user.findUnique({
          where: { phone: sellerPhone },
          select: { createdAt: true },
        })
      : null,
  ]);

  if (buyer) {
    const ageDays = daysSince(buyer.createdAt);
    if (ageDays < 1) {
      signals.push({ code: "NEW_BUYER", score: 15, detail: "Buyer account created today" });
    } else if (ageDays < 7) {
      signals.push({ code: "YOUNG_BUYER", score: 8, detail: "Buyer account under a week old" });
    }
  }

  if (seller) {
    const ageDays = daysSince(seller.createdAt);
    if (ageDays < 1) {
      signals.push({ code: "NEW_SELLER", score: 12, detail: "Seller account created today" });
    } else if (ageDays < 7) {
      signals.push({ code: "YOUNG_SELLER", score: 6, detail: "Seller account under a week old" });
    }
  }

  if (!buyer) {
    signals.push({
      code: "UNKNOWN_BUYER",
      score: 10,
      detail: "Buyer has no prior TrustShip record",
    });
  }
  if (!seller) {
    signals.push({
      code: "UNKNOWN_SELLER",
      score: 10,
      detail: "Seller has no prior TrustShip record",
    });
  }

  // --- 3. Dispute history + ratio ----------------------------------------
  if (buyerPhone || sellerPhone) {
    const [buyerTotal, buyerDisputes, sellerTotal, sellerDisputes] = await Promise.all([
      buyerPhone ? prisma.escrowTransaction.count({ where: { buyerPhone } }) : 0,
      buyerPhone
        ? prisma.escrowTransaction.count({
            where: { buyerPhone, status: { in: ["DISPUTE_OPEN", "REFUNDED"] } },
          })
        : 0,
      sellerPhone ? prisma.escrowTransaction.count({ where: { sellerPhone } }) : 0,
      sellerPhone
        ? prisma.escrowTransaction.count({
            where: { sellerPhone, status: { in: ["DISPUTE_OPEN", "REFUNDED"] } },
          })
        : 0,
    ]);

    const buyerRatio = buyerTotal > 0 ? buyerDisputes / buyerTotal : 0;
    const sellerRatio = sellerTotal > 0 ? sellerDisputes / sellerTotal : 0;

    if (buyerDisputes >= 3 || buyerRatio >= 0.5) {
      signals.push({
        code: "BUYER_DISPUTE_HISTORY",
        score: 20,
        detail: `Buyer has ${buyerDisputes} dispute(s) across ${buyerTotal} transaction(s)`,
      });
    } else if (buyerDisputes > 0) {
      signals.push({
        code: "BUYER_PRIOR_DISPUTE",
        score: 8,
        detail: `Buyer has ${buyerDisputes} prior dispute(s)`,
      });
    }

    if (sellerDisputes >= 3 || sellerRatio >= 0.5) {
      signals.push({
        code: "SELLER_DISPUTE_HISTORY",
        score: 22,
        detail: `Seller has ${sellerDisputes} dispute(s) across ${sellerTotal} transaction(s)`,
      });
    } else if (sellerDisputes > 0) {
      signals.push({
        code: "SELLER_PRIOR_DISPUTE",
        score: 10,
        detail: `Seller has ${sellerDisputes} prior dispute(s)`,
      });
    }

    // --- 4. Repeat counterparty ------------------------------------------
    if (buyerPhone && sellerPhone) {
      const pairCount = await prisma.escrowTransaction.count({
        where: { buyerPhone, sellerPhone },
      });
      if (pairCount === 0) {
        signals.push({
          code: "FIRST_TIME_PAIR",
          score: 8,
          detail: "First transaction between this buyer and seller",
        });
      } else if (pairCount >= 3) {
        signals.push({
          code: "ESTABLISHED_PAIR",
          score: -10,
          detail: `${pairCount} prior transactions between this pair`,
        });
      }
    }

    // --- 5. Velocity ------------------------------------------------------
    if (buyerPhone) {
      const last24h = await prisma.escrowTransaction.count({
        where: {
          buyerPhone,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (last24h >= 5) {
        signals.push({
          code: "HIGH_VELOCITY",
          score: 18,
          detail: `${last24h} transactions by this buyer in 24 hours`,
        });
      } else if (last24h >= 3) {
        signals.push({
          code: "ELEVATED_VELOCITY",
          score: 8,
          detail: `${last24h} transactions by this buyer in 24 hours`,
        });
      }
    }
  }

  // --- 6. Unverified payout details --------------------------------------
  if (sellerPhone) {
    const sellerRecord = await prisma.user.findUnique({
      where: { phone: sellerPhone },
      select: { bankVerifiedAt: true, accountNumber: true },
    });
    if (sellerRecord && !sellerRecord.accountNumber) {
      signals.push({
        code: "NO_PAYOUT_ACCOUNT",
        score: 15,
        detail: "Seller has no payout account on file",
      });
    } else if (sellerRecord && !sellerRecord.bankVerifiedAt) {
      signals.push({
        code: "UNVERIFIED_PAYOUT_ACCOUNT",
        score: 6,
        detail: "Seller payout account has not been name-verified",
      });
    }
  }

  const rawScore = signals.reduce((sum, signal) => sum + signal.score, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const level = bandFor(score);

  return {
    score,
    level,
    signals,
    summary: buildSummary(level, signals),
    evaluatedAt: new Date().toISOString(),
    // transactionId is intentionally not returned — callers pass refs around.
    ...(transactionId ? {} : {}),
  };
}

function buildSummary(level: RiskLevel, signals: RiskSignal[]): string {
  const positives = signals.filter((s) => s.score > 0);
  if (level === "LOW" && positives.length === 0) {
    return "No elevated risk signals detected.";
  }
  const top = [...positives].sort((a, b) => b.score - a.score).slice(0, 3);
  const headline =
    level === "HIGH"
      ? "High risk — manual review recommended."
      : level === "MEDIUM"
        ? "Moderate risk — keep an eye on this transaction."
        : "Low risk.";
  return `${headline} ${top.map((s) => s.detail).join("; ")}`;
}

/**
 * Evaluate and cache the risk band on the transaction row so table views can
 * render the badge without recomputing per request.
 */
export async function evaluateAndCacheRisk(
  transactionRef: string
): Promise<RiskAssessment | null> {
  const assessment = await evaluateRisk({ transactionRef });
  if (!assessment) return null;

  await prisma.escrowTransaction.update({
    where: { transactionRef },
    data: { riskLevel: assessment.level, riskScore: assessment.score },
  });

  return assessment;
}

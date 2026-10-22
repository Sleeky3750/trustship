// lib/events.ts
//
// Append-only escrow lifecycle event log.
//
// The admin timeline must show ONLY events that actually occurred. Deriving a
// timeline from a single row's timestamps invents history: it cannot represent
// "webhook arrived twice", "refund rejected", or "dispute reopened". This
// module records each real transition as an immutable row.
//
// Callers should treat `recordEvent` as fire-and-forget-but-awaited: it never
// throws into the caller's happy path (a failed event write must not abort a
// financial operation), but it logs loudly so gaps are visible.

import { prisma } from "@/lib/prisma";

export type ActorKind = "ADMIN" | "SYSTEM" | "WEBHOOK" | "BUYER" | "SELLER";

export interface RecordEventInput {
  transactionId: string;
  transactionRef: string;
  type: string;
  message?: string;
  metadata?: Record<string, unknown>;
  actorKind?: ActorKind;
  actorId?: string | null;
}

/** Append an event row. Never throws. */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    await prisma.transactionEvent.create({
      data: {
        transactionId: input.transactionId,
        transactionRef: input.transactionRef,
        type: input.type,
        message: input.message ?? null,
        metadata: (input.metadata ?? undefined) as any,
        actorKind: input.actorKind ?? "SYSTEM",
        actorId: input.actorId ?? null,
      },
    });
  } catch (error) {
    // A timeline gap is preferable to aborting a money operation.
    console.error(
      `Failed to record transaction event ${input.type} for ${input.transactionRef}:`,
      error
    );
  }
}

/** Canonical event type constants (string contract shared with the UI). */
export const EVENTS = {
  CREATED: "ESCROW_CREATED",
  SELLER_NOTIFIED: "SELLER_NOTIFIED",
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",
  ESCROW_FUNDED: "ESCROW_FUNDED",
  DELIVERY_INITIATED: "DELIVERY_INITIATED",
  DELIVERY_REPORTED: "DELIVERY_REPORTED",
  BUYER_CONFIRMED: "BUYER_CONFIRMED",
  DISPUTE_OPENED: "DISPUTE_OPENED",
  DISPUTE_UPDATED: "DISPUTE_UPDATED",
  REFUND_REQUESTED: "REFUND_REQUESTED",
  REFUND_COMPLETED: "REFUND_COMPLETED",
  RELEASE_AUTHORIZED: "RELEASE_AUTHORIZED",
  RELEASE_COMPLETED: "RELEASE_COMPLETED",
  COMPLETED: "TRANSACTION_COMPLETED",
  WEBHOOK_RECEIVED: "WEBHOOK_RECEIVED",
  WEBHOOK_DUPLICATE: "WEBHOOK_DUPLICATE",
} as const;

/**
 * Fetch the timeline for a escrow, newest last (chronological for rendering).
 * Only rows that exist are returned — nothing is synthesised.
 */
export async function getTransactionTimeline(transactionId: string) {
  return prisma.transactionEvent.findMany({
    where: { transactionId },
    orderBy: { createdAt: "asc" },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

/**
 * Constant-time equality for a caller-provided value against the expected
 * secret (length leak only — no content-dependent timing).
 */
function isConstantTimeMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Processing outcome that must be communicated with a specific HTTP status. */
class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Flutterwave signature header — fail closed in production.
    //    (Supports both the historical FLUTTERWAVE_WEBHOOK_SECRET_HASH name
    //     and FLUTTERWAVE_SECRET_HASH.)
    const signature = request.headers.get("verif-hash");
    const secretHash =
      process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH ||
      process.env.FLUTTERWAVE_SECRET_HASH;

    if (!secretHash) {
      if (process.env.NODE_ENV === "production") {
        // Throws -> caught below -> 500: the webhook is rejected rather than
        // processed unverified. Flutterwave will retry until it is configured.
        throw new Error(
          "FLUTTERWAVE_WEBHOOK_SECRET_HASH is not configured — refusing to accept unverified webhooks in production."
        );
      }
      console.warn(
        "Flutterwave webhook: signature secret not configured — bypassing verification (development only)."
      );
    } else if (!isConstantTimeMatch(signature, secretHash)) {
      console.error("Flutterwave Webhook Security: Invalid verif-hash signature header");
      return NextResponse.json({ error: "Unauthorized signature" }, { status: 401 });
    }

    const payload = await request.json();

    // 2. Idempotent financial event logging: a unique eventId means a replayed
    //    event is rejected at insert time (P2002) BEFORE any state change, so
    //    Flutterwave can retry indefinitely without reprocessing. The marker is
    //    rolled back if processing fails (see below), so a transient failure
    //    can never permanently block a legitimate retry.
    const dataId = payload?.data?.id;
    const eventId =
      dataId !== undefined && dataId !== null && dataId !== ""
        ? `${payload.event ?? "unknown"}:${dataId}`
        : null;

    let logRowId: string | null = null;
    try {
      const logRow = await prisma.webhookLog.create({
        data: {
          provider: "FLUTTERWAVE",
          payload: payload,
          eventId,
        },
      });
      logRowId = logRow.id;
    } catch (logErr: unknown) {
      const code = (logErr as { code?: string })?.code;
      if (code === "P2002") {
        console.warn(`Flutterwave webhook: duplicate event ${eventId} ignored.`);
        return NextResponse.json(
          { received: true, message: "Duplicate event ignored" },
          { status: 200 }
        );
      }
      console.warn("Could not save to WebhookLog table (skipping log):", logErr);
    }

    try {
      await processEvent(payload);
    } catch (processingErr) {
      // Roll back the idempotency marker so the provider's retry of this same
      // event is processed (a stuck marker would silently drop the event).
      if (logRowId) {
        try {
          await prisma.webhookLog.delete({ where: { id: logRowId } });
        } catch {
          /* best effort — the state guards still make reprocessing safe */
        }
      }
      throw processingErr;
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Flutterwave webhook processing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Business processing for one webhook event. State transitions are guarded
 * (only fundable statuses can lock, already-locked is a no-op), so a replay
 * that slips past the marker can never double-apply anything.
 */
async function processEvent(payload: any): Promise<void> {
  if (payload?.event !== "charge.completed" || payload?.data?.status !== "successful") {
    return;
  }

  const txRef = payload.data.tx_ref;
  const flwTransactionId = String(payload.data.id);

  const transaction = await prisma.escrowTransaction.findUnique({
    where: { transactionRef: txRef },
  });

  if (!transaction) {
    console.error(`Flutterwave Webhook: Transaction ref ${txRef} not found in database`);
    throw new HttpError(404, "Transaction ref not found");
  }

  // Already settled — acknowledge without re-processing.
  if (transaction.status === "ESCROW_LOCKED") {
    return;
  }

  // Only fundable states may transition to ESCROW_LOCKED — a late or
  // replayed event must never revive a cancelled/disputed/completed escrow.
  const LOCKABLE_STATUSES = ["PENDING_DEPOSIT", "PENDING_PAYMENT", "PENDING_AGREEMENT"];
  if (!LOCKABLE_STATUSES.includes(transaction.status)) {
    console.warn(
      `Flutterwave Webhook: ignoring charge for ${txRef} — status ${transaction.status} is not lockable.`
    );
    return;
  }

  // Amount integrity: the charge must equal exactly what this escrow
  // requires (item + platform fee + gateway pass-through + waybill).
  const chargedAmount = Number(payload.data.amount);
  if (Number.isFinite(chargedAmount) && chargedAmount !== transaction.totalEscrow) {
    console.error(
      `Flutterwave Webhook: amount mismatch for ${txRef} — charged ${chargedAmount}, expected ${transaction.totalEscrow}`
    );
    throw new HttpError(409, "Amount mismatch");
  }

  await prisma.escrowTransaction.update({
    where: { transactionRef: txRef },
    data: {
      status: "ESCROW_LOCKED",
      paymentProvider: "FLUTTERWAVE",
      flwTransactionId,
    },
  });

  console.log(`✅ Escrow payment confirmed and locked for txRef: ${txRef}`);

  // Dual notification (spec): the buyer gets the private release PIN, the
  // seller is told to dispatch. Failures never fail the webhook.
  try {
    await sendWhatsAppMessage(
      transaction.buyerPhone,
      `🔒 *Escrow Funded & Locked!*\n\n` +
        `We've secured ₦${transaction.totalEscrow.toLocaleString()} for escrow ` +
        `*${transaction.transactionRef}* (${transaction.itemTitle ?? "item"}).\n\n` +
        `🔑 *Your private release PIN: ${transaction.releasePin}*\n\n` +
        `Keep it safe — send it back to us once you've received the item to ` +
        `release ₦${(transaction.totalEscrow - transaction.platformFee - (transaction.gatewayFee ?? 0)).toLocaleString()} to the seller.`
    );
    await sendWhatsAppMessage(
      transaction.sellerPhone,
      `💰 *Payment secured for escrow ${transaction.transactionRef}!*\n\n` +
        `The funds are locked in TrustShip escrow. Please dispatch the item — ` +
        `once the buyer confirms delivery, payment will be released to your bank.`
    );
  } catch (notifyErr) {
    console.warn("Flutterwave webhook: participant notification failed:", notifyErr);
  }
}

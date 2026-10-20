import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

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

    // 2. Log webhook payload to WebhookLog table safely
    try {
      await prisma.webhookLog.create({
        data: {
          provider: "FLUTTERWAVE",
          payload: payload,
        },
      });
    } catch (logErr) {
      console.warn("Could not save to WebhookLog table (skipping log):", logErr);
    }

    // 3. Process successful payment event
    if (payload.event === "charge.completed" && payload.data.status === "successful") {
      const txRef = payload.data.tx_ref;
      const flwTransactionId = String(payload.data.id);

      const transaction = await prisma.escrowTransaction.findUnique({
        where: { transactionRef: txRef },
      });

      if (!transaction) {
        console.error(`Flutterwave Webhook: Transaction ref ${txRef} not found in database`);
        return NextResponse.json({ error: "Transaction ref not found" }, { status: 404 });
      }

      // Avoid double-processing
      if (transaction.status === "ESCROW_LOCKED") {
        return NextResponse.json({ received: true, message: "Transaction already processed" }, { status: 200 });
      }

      // Update status to ESCROW_LOCKED
      await prisma.escrowTransaction.update({
        where: { transactionRef: txRef },
        data: {
          status: "ESCROW_LOCKED",
          paymentProvider: "FLUTTERWAVE",
          flwTransactionId,
        },
      });

      console.log(`✅ Escrow payment confirmed and locked for txRef: ${txRef}`);
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: any) {
    console.error("Flutterwave webhook processing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}